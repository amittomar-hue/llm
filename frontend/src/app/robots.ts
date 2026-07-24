// App-only build — this deployment has no marketing surface.
// robots.txt disallows the whole app root except /privacy and /terms
// (legal pages) and /docs/api (developer reference for API users).

import type { MetadataRoute } from "next";

const SITE_URL = "https://www.dmoop.com";

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/chat", "/chat/",
    "/admin", "/admin/",
    "/agents", "/agents/",
    "/brand", "/brand/",
    "/signin",
    "/signup",
    "/verify",
    "/forgot-password",
    "/reset-password",
    "/auth/",
    "/api/",
    "/settings/",
  ];

  const allow = ["/privacy", "/terms", "/docs/api"];

  return {
    rules: [
      { userAgent: "*",                  allow, disallow },
      { userAgent: "Googlebot",          allow, disallow },
      { userAgent: "Bingbot",            allow, disallow },
      { userAgent: "GPTBot",             allow, disallow },
      { userAgent: "ChatGPT-User",       allow, disallow },
      { userAgent: "Google-Extended",    allow, disallow },
      { userAgent: "PerplexityBot",      allow, disallow },
      { userAgent: "ClaudeBot",          allow, disallow },
      { userAgent: "anthropic-ai",       allow, disallow },
      { userAgent: "CCBot",              allow, disallow },
      { userAgent: "Applebot",           allow, disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
