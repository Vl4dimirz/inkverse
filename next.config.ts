import type { NextConfig } from "next";

// 'unsafe-eval' is only needed by Turbopack's dev runtime. Production builds
// don't need it, so we drop it there to tighten XSS protection. 'unsafe-inline'
// is still required by Next.js' inline bootstrap script (would need nonces to
// remove — tracked as a separate hardening task).
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://cdn.omise.co https://challenges.cloudflare.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.omise.co https://challenges.cloudflare.com";

// Security response headers applied to every route.
const securityHeaders = [
  // Force HTTPS for 2 years (ignored by browsers on plain http, e.g. localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Block this site from being framed (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Don't let browsers MIME-sniff responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Isolate our browsing context from cross-origin windows (XS-Leaks). Use the
  // allow-popups variant so the Google sign-in popup/redirect still works.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Drop powerful browser features we don't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Content Security Policy. The value locks down which *external* origins may
  // load scripts, connect, or frame us. See scriptSrc note re: unsafe-* above.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://accounts.google.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "frame-src 'self' https://cdn.omise.co https://challenges.cloudflare.com",
      "connect-src 'self' https://api.omise.co https://vault.omise.co https://developer.easyslip.com https://api.easyslip.com https://challenges.cloudflare.com",
    ].join("; "),
  },
];

// Tell search engines NOT to index private/transactional/app-only routes.
// This is a response-header fix so it also covers client-component pages that
// can't export `metadata` (which would otherwise inherit the root layout's
// `robots: { index: true }`).
const noindexHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

// Source patterns for routes that must NOT be indexed. Patterns are precise so
// they never catch the indexable siblings (e.g. /topup landing, /download
// marketing page) — see the keep-indexable list in the SEO audit.
const noindexSources = [
  "/dashboard",
  "/dashboard/:path*",
  "/admin",
  "/admin/:path*",
  "/auth/:path*",
  "/settings",
  "/upload",
  "/topup/checkout/:path*",
  "/topup/processing/:path*",
  "/topup/success/:path*",
  "/downloads",
  "/offline",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  images: {
    // Only proxy/optimize images from hosts we actually use — not the whole web.
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "media.anilist.co" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 64, 96, 128, 256, 300],
    minimumCacheTTL: 2592000, // 30 days
  },
  compress: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // APIs must never be cached by shared caches.
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        // Hashed build assets are immutable.
        source: "/_next/static/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/sitemap.xml",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=43200" },
        ],
      },
      {
        // APK is versioned by filename — safe to cache for a week.
        source: "/downloads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        // PromptPay QR rarely changes — cache for 30 days.
        source: "/promptpay-qr.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000" },
        ],
      },
      // Keep private/transactional/app-only routes out of search indexes.
      ...noindexSources.map((source) => ({ source, headers: noindexHeaders })),
    ];
  },
  async redirects() {
    return [{ source: "/home", destination: "/", permanent: true }];
  },
};

export default nextConfig;
