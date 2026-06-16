import { NextRequest } from "next/server";

// Lightweight fixed-window rate limiter.
//
// NOTE: state is in-memory, so limits are per server instance. That's fine for
// a single Node process; on multi-instance/serverless deployments move this to
// Redis/Upstash for a shared counter. It still meaningfully slows brute-force
// and abuse on any single instance.
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // seconds until the window resets
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count++;
  const retryAfter = Math.ceil((b.reset - now) / 1000);
  if (b.count > limit) return { ok: false, remaining: 0, retryAfter };
  return { ok: true, remaining: limit - b.count, retryAfter };
}

// Client IP for rate-limit keys, from trusted proxy headers.
// SECURITY: never key on the LEFTMOST x-forwarded-for value — it is client-
// controlled (Cloudflare/proxies APPEND the real IP, so a forged header lands
// first), which would let an attacker rotate the key to bypass every per-IP
// limit (login brute-force, scraping, register…). cf-connecting-ip is set by
// Cloudflare to the real client IP and can't be spoofed; x-real-ip is the
// platform-trusted value. Use x-forwarded-for's RIGHTMOST hop only as a fallback.
export function clientIp(req: NextRequest): string {
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
