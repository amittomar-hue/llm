// ─────────────────────────────────────────────────────────────────
// /sitemap.xml — Next.js auto-generates this XML sitemap from the
// export below. Lists every public URL crawlers should discover and
// re-checks via `lastModified` for crawl prioritisation.
//
// Three layers:
//   1. Static public pages (home, resources index) — high priority,
//      change weekly as the blog/homepage updates
//   2. Dynamic resource articles — one URL per entry in RESOURCES,
//      lastModified = publishedAt so search engines re-crawl when
//      we update the publication date
//   3. (Auth/protected pages deliberately excluded — robots.txt
//      already disallows them, no point putting them in the sitemap)
// ─────────────────────────────────────────────────────────────────

import type { MetadataRoute } from "next";
import { listResources } from "@/lib/resources";

const SITE_URL = "https://www.dmoop.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/resources`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const articlePages: MetadataRoute.Sitemap = listResources().map((r) => ({
    url: `${SITE_URL}/resources/${r.slug}`,
    lastModified: new Date(r.publishedAt),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticPages, ...articlePages];
}
