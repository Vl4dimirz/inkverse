import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// ── Global flood / DoS guard ─────────────────────────────────────────────────
// Throttles by client IP in front of every request so a single source can't
// hammer the site or the API. Counters are in-memory → per server instance:
// a best-effort app-layer shield, NOT a replacement for an edge WAF/CDN
// (Cloudflare / Vercel) for real volumetric DDoS. See SECURITY.md.
const WINDOW_MS = 10_000; // 10-second window
const LIMIT_ALL = 120; // any request, per IP / 10s  (~12 req/s sustained)
const LIMIT_API = 40; // /api/*        , per IP / 10s
const LIMIT_AUTH = 12; // /api/auth/*   , per IP / 10s

type Bucket = { count: number; reset: number };
const store = new Map<string, Bucket>();
let lastSweep = 0;

function allow(key: string, max: number, now: number): boolean {
  if (now - lastSweep > 30_000) {
    lastSweep = now;
    for (const [k, b] of store) if (b.reset <= now) store.delete(k);
  }
  const b = store.get(key);
  if (!b || b.reset <= now) {
    store.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  b.count++;
  return b.count <= max;
}

function clientIp(req: NextRequest): string {
  // SECURITY: don't trust the leftmost x-forwarded-for (client-controlled — a
  // forged header would let an attacker rotate the flood-guard key). Prefer the
  // untamperable cf-connecting-ip / x-real-ip; fall back to XFF's rightmost hop.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    return hops[hops.length - 1] || "unknown";
  }
  return "unknown";
}

function tooMany(): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: "คำขอมากเกินไป กรุณาลองใหม่ภายหลัง" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": "10",
        "Cache-Control": "no-store",
      },
    }
  );
}

// Returns a 429 response if the request should be blocked, else null.
function floodGuard(req: NextRequest): NextResponse | null {
  const now = Date.now();
  const ip = clientIp(req);
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/auth")) {
    if (!allow(`auth:${ip}`, LIMIT_AUTH, now)) return tooMany();
  } else if (path.startsWith("/api/")) {
    if (!allow(`api:${ip}`, LIMIT_API, now)) return tooMany();
  }
  if (!allow(`all:${ip}`, LIMIT_ALL, now)) return tooMany();
  return null;
}

export const proxy = auth((req) => {
  // 0) Canonical host: force www → apex. NEXTAUTH_URL is the apex domain, so the
  // OAuth flow must stay on apex — if /api/auth/signin runs on www, NextAuth's
  // PKCE/state cookies get scoped to www and are unreadable when Google sends the
  // user back to the apex callback → error=Configuration. Redirecting early keeps
  // the whole flow (and the rest of the site) on one host.
  const host = req.headers.get("host");

  // 0a) Close the Cloudflare-bypass hole: the bare Vercel origin is publicly
  // reachable and skips Cloudflare's edge bot protection (Bot Fight Mode / AI-bot
  // blocking). Send its stable production alias to the real proxied domain so all
  // traffic goes through Cloudflare. Per-deploy *.vercel.app hash URLs (used by
  // preview builds) are intentionally left alone.
  if (host === "inkverse-tau.vercel.app") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    url.host = "inksverse.com";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  if (host && host.startsWith("www.")) {
    const url = req.nextUrl.clone();
    url.host = host.slice(4); // drop "www."
    return NextResponse.redirect(url, 308);
  }

  // 1) Rate limit first — cheapest rejection, protects everything incl. /api.
  const blocked = floodGuard(req);
  if (blocked) return blocked;

  // 2) Access control for protected areas.
  // NOTE: only the login check lives here. The ROLE check is intentionally done
  // per-page (each /dashboard + /upload page calls auth() and re-checks role
  // against the DB). The edge token's `role` can be stale right after a creator
  // is approved (the DB refresh only happens in the Node auth callback), so
  // gating on it here used to bounce freshly-approved creators away from their
  // own dashboard. Pages self-gate with the fresh role, so this stays safe.
  const session = req.auth;
  const role = (session?.user as { role?: string } | null)?.role;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") && !session) {
    return NextResponse.redirect(
      new URL(`/auth/signin?callbackUrl=/dashboard`, req.url)
    );
  }

  if (pathname.startsWith("/upload") && !session) {
    return NextResponse.redirect(
      new URL(`/auth/signin?callbackUrl=/upload`, req.url)
    );
  }

  if (pathname.startsWith("/admin")) {
    // Admin promotions are manual + rare, so the stale-role risk doesn't apply
    // the same way; keep the strict edge gate as defence in depth.
    if (!session || role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Run on every route except Next's static output (cheap & cacheable).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
