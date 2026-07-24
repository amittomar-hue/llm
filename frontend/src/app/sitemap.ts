// App-only build — public sitemap only lists the legal pages.
// The root URL redirects to /chat which is auth-gated, so it's not
// worth listing; likewise every app surface is behind auth and
// disallowed by robots.txt.

import type { MetadataRoute } from "next";

const SITE_URL = "https://www.dmoop.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/docs/api`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
