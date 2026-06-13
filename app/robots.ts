import { MetadataRoute } from "next";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/upload", "/dashboard", "/api/", "/auth/", "/topup/checkout"],
      },
      {
        // Block AI training crawlers from the whole site.
        userAgent: ["GPTBot", "CCBot", "Google-Extended", "anthropic-ai", "ClaudeBot"],
        disallow: ["/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
