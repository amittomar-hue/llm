// ─────────────────────────────────────────────────────────────────
// Server-side site scraper. When the user pastes a URL or mentions a
// domain ("check acmehire.io then create the GTM"), we fetch the home
// page + a handful of strategically-named internal pages (about,
// products, pricing, customers, blog) so the model has the REAL site
// content to ground on, not Tavily snippets.
// ─────────────────────────────────────────────────────────────────

const PAGE_CHAR_CAP = 6000;       // per-page text cap after HTML strip
const TOTAL_CHAR_CAP = 22000;     // total budget across all scraped pages
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ReverbBot/1.0; +https://reverb.ai/bot)";

// Strategic page paths to try — most marketing sites use some subset.
// Ordered by typical signal value for GTM analysis.
const PRIORITY_PATHS = [
  "/",
  "/about",
  "/about-us",
  "/product",
  "/products",
  "/features",
  "/solutions",
  "/pricing",
  "/customers",
  "/case-studies",
  "/use-cases",
];

export interface ScrapedPage {
  url: string;
  title: string;
  description: string | null;
  text: string;
  char_count: number;
}

export interface ScrapeResult {
  root_url: string;
  hostname: string;
  pages: ScrapedPage[];
  errors: string[];
}

// Detect URLs and bare hostnames in user text.
// Examples it catches:
//   "https://example.com/path"
//   "example.com"
//   "www.example.com"
//   "check acmehire.io"
// Avoids false positives: requires a recognized TLD or known protocol.
const URL_OR_HOST_RE =
  /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/[^\s"'<>]*)?/gi;

const COMMON_TLDS = new Set([
  "ai", "com", "co", "io", "net", "org", "app", "dev", "tech", "agency",
  "studio", "design", "shop", "store", "online", "site", "us", "uk", "in",
  "ca", "au", "eu", "de", "fr", "es", "it", "jp", "br", "cn", "ru",
]);

export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const matches = text.matchAll(URL_OR_HOST_RE);
  for (const m of matches) {
    const host = m[1].toLowerCase();
    const tld = host.split(".").pop()!;
    if (!COMMON_TLDS.has(tld)) continue;
    // Skip obvious file extensions / email TLDs we don't want
    if (host.endsWith(".png") || host.endsWith(".jpg") || host.endsWith(".pdf")) continue;
    const proto = m[0].startsWith("http") ? "" : "https://";
    const fullUrl = `${proto}${m[0].replace(/^https?:\/\//i, "")}`;
    found.add(fullUrl);
  }
  return [...found];
}

function stripHtmlToText(html: string): string {
  // Remove script + style + svg + nav + footer noise, then strip tags.
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  // Try to keep main / article content if present — these are the meatiest.
  const mainMatch = cleaned.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (mainMatch && mainMatch[1].length > 500) {
    cleaned = mainMatch[1];
  }

  return cleaned
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .replace(/(\s*\n\s*){2,}/g, "\n\n")
    .trim();
}

function extractMeta(html: string): { title: string; description: string | null } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i) ||
    html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  return {
    title: (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    description: descMatch ? descMatch[1].slice(0, 480) : null,
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(tid);
  }
}

async function fetchPage(url: string): Promise<ScrapedPage | null> {
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;
    // Cap response size at 1.5MB to avoid blowing up on huge pages.
    const buf = await res.arrayBuffer();
    const html = new TextDecoder("utf-8", { fatal: false })
      .decode(buf.byteLength > 1_500_000 ? buf.slice(0, 1_500_000) : buf);
    const { title, description } = extractMeta(html);
    const text = stripHtmlToText(html).slice(0, PAGE_CHAR_CAP);
    if (text.length < 100) return null;
    return {
      url,
      title: title || url,
      description,
      text,
      char_count: text.length,
    };
  } catch {
    return null;
  }
}

function findInternalLinksFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const base = new URL(baseUrl);
  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(anchorRe)) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.hostname !== base.hostname) continue;
      // Skip mail/tel/anchors/file links
      if (!/^https?:$/i.test(u.protocol)) continue;
      if (/\.(pdf|png|jpg|jpeg|gif|svg|webp|zip|mp4|mp3|woff2?)$/i.test(u.pathname)) continue;
      // Normalize: drop fragment, keep path + query
      u.hash = "";
      links.add(u.toString());
    } catch {
      // ignore malformed
    }
  }
  return [...links];
}

/**
 * Scrape a site: fetch the root page, then a handful of strategically-
 * named pages found on the root (about / products / pricing / case studies)
 * up to a total content budget. Returns extracted text per page so the
 * model can reason about the actual site, not just Tavily snippets.
 */
export async function scrapeSite(
  inputUrl: string,
  maxPages = 5
): Promise<ScrapeResult> {
  let rootUrl: string;
  let hostname: string;
  try {
    const u = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
    u.hash = "";
    rootUrl = u.toString();
    hostname = u.hostname;
  } catch {
    return { root_url: inputUrl, hostname: inputUrl, pages: [], errors: ["Invalid URL"] };
  }

  const errors: string[] = [];
  const pages: ScrapedPage[] = [];
  let totalChars = 0;

  // 1. Root page
  let rootHtml = "";
  try {
    const res = await fetchWithTimeout(rootUrl, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      errors.push(`Root ${rootUrl} → ${res.status}`);
      return { root_url: rootUrl, hostname, pages: [], errors };
    }
    const buf = await res.arrayBuffer();
    rootHtml = new TextDecoder("utf-8", { fatal: false })
      .decode(buf.byteLength > 1_500_000 ? buf.slice(0, 1_500_000) : buf);
  } catch (e) {
    errors.push(`Root fetch failed: ${e instanceof Error ? e.message : "unknown"}`);
    return { root_url: rootUrl, hostname, pages: [], errors };
  }

  const { title: rootTitle, description: rootDesc } = extractMeta(rootHtml);
  const rootText = stripHtmlToText(rootHtml).slice(0, PAGE_CHAR_CAP);
  if (rootText.length >= 100) {
    pages.push({
      url: rootUrl,
      title: rootTitle || hostname,
      description: rootDesc,
      text: rootText,
      char_count: rootText.length,
    });
    totalChars += rootText.length;
  }

  // 2. Discover candidate internal pages
  const onPage = findInternalLinksFromHtml(rootHtml, rootUrl);
  const candidateSet = new Set<string>();
  // Prioritize known marketing paths if they exist
  for (const path of PRIORITY_PATHS.slice(1)) {
    const candidate = `${new URL(rootUrl).origin}${path}`;
    if (onPage.some((u) => u === candidate || u === candidate + "/")) {
      candidateSet.add(candidate);
    }
  }
  // Then add other on-page links until we have enough candidates
  for (const u of onPage) {
    if (candidateSet.size >= maxPages * 2) break;
    candidateSet.add(u);
  }

  // 3. Fetch candidates in parallel, take the first N that succeed within budget
  const candidates = [...candidateSet].slice(0, maxPages * 2);
  const fetched = await Promise.all(candidates.map((u) => fetchPage(u)));
  for (const p of fetched) {
    if (!p) continue;
    if (pages.length >= maxPages) break;
    if (totalChars + p.text.length > TOTAL_CHAR_CAP) {
      // Truncate this page to fit the remaining budget
      const remaining = TOTAL_CHAR_CAP - totalChars;
      if (remaining < 300) break;
      p.text = p.text.slice(0, remaining);
      p.char_count = p.text.length;
    }
    pages.push(p);
    totalChars += p.char_count;
  }

  return { root_url: rootUrl, hostname, pages, errors };
}

/**
 * Format a scrape result as a system-message block for the model.
 */
export function formatScrapeAsContext(result: ScrapeResult): string {
  if (result.pages.length === 0) {
    return `Note: tried to scrape ${result.hostname} but could not retrieve content${
      result.errors.length ? ` (${result.errors[0]})` : ""
    }. Proceed without site context.`;
  }

  const lines = [
    `═══ LIVE WEBSITE SCRAPE — ${result.hostname} ═══`,
    `(This is the ACTUAL content of the site the user asked about. Treat it as`,
    ` the authoritative source for what this company does, who they serve,`,
    ` their positioning, products, and proof points. Quote / cite specific`,
    ` phrases from the site. Use a [W1], [W2] inline citation per page.)`,
    "",
    `Pages scraped: ${result.pages.length}  ·  Total chars: ${result.pages.reduce(
      (a, p) => a + p.char_count,
      0
    )}`,
    "",
  ];
  result.pages.forEach((p, i) => {
    lines.push(`────── [W${i + 1}] ${p.url} ──────`);
    lines.push(`Title: ${p.title}`);
    if (p.description) lines.push(`Meta description: ${p.description}`);
    lines.push("");
    lines.push(p.text);
    lines.push("");
  });
  return lines.join("\n");
}
