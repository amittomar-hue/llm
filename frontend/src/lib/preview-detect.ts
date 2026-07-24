// ─────────────────────────────────────────────────────────────────
// Detect whether a code block can be opened in Reverb's preview drawer.
// Returns the rendering "kind" for routing inside PreviewDrawer.
//   - html      → render in sandboxed iframe via srcDoc
//   - svg       → inline render
//   - markdown  → re-render through Reverb's Markdown component
//   - json      → pretty-printed code view
//   - react     → flag-only (no JSX runtime yet)
// ─────────────────────────────────────────────────────────────────

export type PreviewKind =
  | "html"
  | "svg"
  | "markdown"
  | "json"
  | "react"
  | null;

const HTML_DOC_RE = /<!doctype\s+html|<html[\s>]/i;
const HTML_FRAGMENT_RE = /<(?:body|div|section|main|nav|header|footer|h1|button|form|input|a)\s|<\/(?:body|div|section|main|nav|header|footer|h1|button|form|input|a)>/i;
const SVG_RE = /<svg[\s>]/i;
const REACT_DEFAULT_EXPORT_RE = /export\s+default\s+(?:function|const|class)\s+[A-Z]/;

export function detectPreviewKind(language: string, code: string): PreviewKind {
  if (!code || code.length < 30) return null;
  const lang = (language || "").toLowerCase();
  const trimmed = code.trim();

  // ── HTML ────────────────────────────────────────────────────
  if (lang === "html" || lang === "htm" || lang === "xhtml") {
    return "html";
  }
  // Catch HTML blocks tagged as something else (e.g. just "html" or no lang)
  if (HTML_DOC_RE.test(trimmed) || (HTML_FRAGMENT_RE.test(trimmed) && trimmed.length > 200)) {
    return "html";
  }

  // ── SVG ─────────────────────────────────────────────────────
  if (lang === "svg" || (lang === "xml" && SVG_RE.test(trimmed))) {
    return "svg";
  }
  if (SVG_RE.test(trimmed) && trimmed.includes("</svg>")) {
    return "svg";
  }

  // ── Markdown ────────────────────────────────────────────────
  if (lang === "md" || lang === "markdown" || lang === "mdx") {
    return "markdown";
  }

  // ── JSON ────────────────────────────────────────────────────
  if (lang === "json") {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      return null;
    }
  }

  // ── React / JSX / TSX (no runtime — we surface as preview-able
  //    but render as syntax-highlighted code with a "needs runtime" hint
  //    or wrap a minimal preview by stripping the export. Keep null for now
  //    to avoid confusing users — re-enable when a JSX runtime is wired.) ──
  if ((lang === "jsx" || lang === "tsx" || lang === "react") && REACT_DEFAULT_EXPORT_RE.test(trimmed)) {
    // Returning null → no Preview button. Future: bundle with esbuild-wasm.
    return null;
  }

  return null;
}

/** Build a complete HTML document if the user gave us a fragment. */
export function wrapHtmlFragment(code: string): string {
  if (HTML_DOC_RE.test(code)) return code;
  // Looks like a fragment — wrap it so the iframe has a usable doc.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reverb Preview</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;line-height:1.6;color:#1f1b16;background:#fafaf8}
</style>
</head>
<body>
${code}
</body>
</html>`;
}
