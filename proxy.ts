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
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
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
  // 1) Rate limit first — cheapest rejection, protects everything incl. /api.
  const blocked = floodGuard(req);
  if (blocked) return blocked;

  // 2) Role-based access control for protected areas.
  const session = req.auth;
  const role = (session?.user as { role?: string } | null)?.role;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/auth/signin?callbackUrl=/dashboard`, req.url)
      );
    }
    if (role !== "TRANSLATOR" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/apply", req.url));
    }
  }

  if (pathname.startsWith("/upload")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/auth/signin?callbackUrl=/upload`, req.url)
      );
    }
    // Must be an approved translator to upload — otherwise send them to apply.
    if (role !== "TRANSLATOR" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/apply", req.url));
    }
  }

  if (pathname.startsWith("/admin")) {
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
