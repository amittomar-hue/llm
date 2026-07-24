"use client";

import { saveAs } from "file-saver";

export type ExportFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "csv"
  | "json"
  | "md"
  | "txt"
  | "html";

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf:  "PDF",
  docx: "Word (.docx)",
  xlsx: "Excel (.xlsx)",
  pptx: "PowerPoint (.pptx)",
  csv:  "CSV",
  json: "JSON",
  md:   "Markdown",
  txt:  "Plain text",
  html: "HTML",
};

export const FORMAT_MIME: Record<ExportFormat, string> = {
  pdf:  "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv:  "text/csv",
  json: "application/json",
  md:   "text/markdown",
  txt:  "text/plain",
  html: "text/html",
};

// ─────────────────────────────────────────────────────────────────
// Format detection from the user's prompt.
// Matches phrases like "as PDF", "in Excel", "give me a Word doc",
// "make this a deck", "csv format", etc.
// ─────────────────────────────────────────────────────────────────
// Each pattern includes the canonical form + common typos / variants the
// model sees in the wild. "dox", "ducks", "wrd", "exel", "powepoint" etc.
const PATTERNS: Array<{ format: ExportFormat; re: RegExp }> = [
  { format: "pdf",  re: /\b(pdf|pdfs|portable document|\.pdf)\b/i },
  { format: "docx", re: /\b(docx?|dox|ducks|docks|wrd|word document|word doc|word file|microsoft word|ms\s*word|\.docx?)\b/i },
  { format: "xlsx", re: /\b(xlsx?|excel(?:\s+file)?|exel|excell|excelll?|spread\s*sheet|workbook|\.xlsx?)\b/i },
  { format: "pptx", re: /\b(ppt|pptx|power\s*point|powepoint|powerpiont|deck|presentation|slides?(?:\s+(?:deck|format))?|\.pptx?)\b/i },
  { format: "csv",  re: /\b(csv|comma[-\s]separated(?:\s+values)?|\.csv)\b/i },
  { format: "json", re: /\b(json(?:\s+(?:format|file))?|\.json)\b/i },
  { format: "md",   re: /\b(markdown|mark\s*down|\.md|md\s+file)\b/i },
  { format: "html", re: /\b(html|webpage|web\s*page|\.html?)\b/i },
  { format: "txt",  re: /\b(plain\s*text|text\s*file|\.txt)\b/i },
];

export function detectFormat(prompt: string): ExportFormat | null {
  if (!prompt) return null;
  // Check more specific formats first (PPTX before generic "slide", etc.)
  for (const { format, re } of PATTERNS) {
    if (re.test(prompt)) return format;
  }
  return null;
}

// "Convert this", "give this as", "save this as", "turn this into", etc.
// When detected AND a format is detected AND there's a prior assistant
// message, we should NOT call the LLM — we should just take the prior
// answer and offer it as a download in the requested format.
const CONVERSION_INTENT_RE =
  /\b(?:convert|export|save|download|give\s+(?:me\s+)?(?:this|it)|turn|make|put|render|change|transform|format)\b.{0,40}\b(?:this|it|above|previous|that)\b|\b(?:this|it|above|previous|that)\b.{0,40}\b(?:in(?:to)?|as|to)\s+(?:a\s+)?(?:pdf|doc|docx|word|excel|xlsx|csv|json|ppt|pptx|powerpoint|deck|markdown|md|html|txt)|\b(?:convert|export|download)\s+(?:in(?:to)?|to|as)\s+(?:pdf|doc|docx|word|excel|xlsx|csv|json|ppt|pptx|powerpoint|deck|markdown|md|html|txt)/i;

/**
 * Returns true if the user's message reads like "please convert the
 * previous answer into <format>" rather than "please generate a new
 * answer in <format>". The distinction matters: the conversion case
 * should NOT call the LLM — just package the prior message as the file.
 */
export function isConversionRequest(prompt: string): boolean {
  if (!prompt) return false;
  if (prompt.length > 200) return false; // long prompts are real questions
  return CONVERSION_INTENT_RE.test(prompt);
}

// ─────────────────────────────────────────────────────────────────
// Filename derivation
// ─────────────────────────────────────────────────────────────────
export function buildFilename(prompt: string, format: ExportFormat): string {
  const cleaned = (prompt || "reverb-output")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .toLowerCase() || "reverb-output";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${cleaned}-${stamp}.${format}`;
}

// ─────────────────────────────────────────────────────────────────
// Markdown → plaintext utility (drops markdown syntax)
// ─────────────────────────────────────────────────────────────────
function mdToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?|```/g, ""))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, (m) => m)
    .trim();
}

// ─────────────────────────────────────────────────────────────────
// Extract first markdown table from content (used by CSV/XLSX)
// ─────────────────────────────────────────────────────────────────
function extractTable(md: string): string[][] | null {
  const lines = md.split(/\r?\n/);
  const tableLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      tableLines.push(line.trim());
      inTable = true;
    } else if (inTable) {
      break;
    }
  }
  if (tableLines.length < 2) return null;
  const rows = tableLines
    .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) =>
      l
        .replace(/^\s*\||\|\s*$/g, "")
        .split("|")
        .map((c) => c.trim())
    );
  return rows.length ? rows : null;
}

function rowsToCsv(rows: string[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const v = c ?? "";
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(",")
    )
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Per-format exporters. All run in the browser to keep serverless
// cost at zero and to handle the largest content without round-trips.
// ─────────────────────────────────────────────────────────────────

async function exportPdf(content: string, filename: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usableW = pageW - margin * 2;

  const lineHeight = 16;
  let cursorY = margin;

  const writeLine = (text: string, options: { size?: number; bold?: boolean; gap?: number } = {}) => {
    const { size = 11, bold = false, gap = 0 } = options;
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const wrapped = doc.splitTextToSize(text, usableW);
    for (const w of wrapped as string[]) {
      if (cursorY > pageH - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(w, margin, cursorY);
      cursorY += lineHeight * (size / 11);
    }
    cursorY += gap;
  };

  // Render markdown roughly: headings bigger/bold, lists prefixed, code wrapped.
  const lines = content.split(/\r?\n/);
  let inCode = false;
  for (const raw of lines) {
    if (/^```/.test(raw)) { inCode = !inCode; continue; }
    if (inCode) { writeLine(raw, { size: 9 }); continue; }
    const h1 = raw.match(/^#\s+(.*)/);
    const h2 = raw.match(/^##\s+(.*)/);
    const h3 = raw.match(/^###\s+(.*)/);
    const bullet = raw.match(/^[-*+]\s+(.*)/);
    const ol = raw.match(/^(\d+\.)\s+(.*)/);
    const quote = raw.match(/^>\s?(.*)/);
    if (h1) writeLine(h1[1], { size: 20, bold: true, gap: 6 });
    else if (h2) writeLine(h2[1], { size: 16, bold: true, gap: 4 });
    else if (h3) writeLine(h3[1], { size: 13, bold: true, gap: 2 });
    else if (bullet) writeLine("• " + bullet[1].replace(/\*\*([^*]+)\*\*/g, "$1"));
    else if (ol) writeLine(ol[1] + " " + ol[2].replace(/\*\*([^*]+)\*\*/g, "$1"));
    else if (quote) writeLine("“" + quote[1] + "”", { size: 11 });
    else if (raw.trim() === "") cursorY += lineHeight / 2;
    else writeLine(raw.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1"));
  }

  const blob = doc.output("blob");
  saveAs(blob, filename);
}

async function exportDocx(content: string, filename: string): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, LevelFormat, AlignmentType, convertInchesToTwip } =
    await import("docx");

  const paragraphs: InstanceType<typeof Paragraph>[] = [];
  const lines = content.split(/\r?\n/);
  let inCode = false;
  for (const raw of lines) {
    if (/^```/.test(raw)) { inCode = !inCode; continue; }
    if (inCode) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: raw, font: "Consolas", size: 18 })] }));
      continue;
    }
    const h1 = raw.match(/^#\s+(.*)/);
    const h2 = raw.match(/^##\s+(.*)/);
    const h3 = raw.match(/^###\s+(.*)/);
    const bullet = raw.match(/^[-*+]\s+(.*)/);
    const ol = raw.match(/^\d+\.\s+(.*)/);
    const quote = raw.match(/^>\s?(.*)/);
    if (h1) paragraphs.push(new Paragraph({ text: h1[1], heading: HeadingLevel.HEADING_1 }));
    else if (h2) paragraphs.push(new Paragraph({ text: h2[1], heading: HeadingLevel.HEADING_2 }));
    else if (h3) paragraphs.push(new Paragraph({ text: h3[1], heading: HeadingLevel.HEADING_3 }));
    else if (bullet) paragraphs.push(new Paragraph({ text: bullet[1].replace(/\*\*([^*]+)\*\*/g, "$1"), bullet: { level: 0 } }));
    else if (ol) paragraphs.push(new Paragraph({ text: ol[1].replace(/\*\*([^*]+)\*\*/g, "$1"), numbering: { reference: "default-numbering", level: 0 } }));
    else if (quote) paragraphs.push(new Paragraph({ children: [new TextRun({ text: quote[1], italics: true })] }));
    else if (raw.trim() === "") paragraphs.push(new Paragraph({ text: "" }));
    else paragraphs.push(new Paragraph({ text: raw.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1") }));
  }

  // Numbering config MUST be declared at the Document level for any
  // Paragraph that references it (via `numbering: { reference, level }`).
  // Without this, Packer.toBlob() emits a malformed .docx that Word
  // refuses to open and Office Online renders as a blank file — which
  // is exactly what was happening for any assistant response with a
  // numbered list ("1. …  2. …"). Bullet lists work without config.
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: {
                    left: convertInchesToTwip(0.5),
                    hanging: convertInchesToTwip(0.25),
                  },
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: "%2.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: {
                    left: convertInchesToTwip(1),
                    hanging: convertInchesToTwip(0.25),
                  },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [{ children: paragraphs }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

async function exportXlsx(content: string, filename: string): Promise<void> {
  const XLSX = await import("xlsx");
  const table = extractTable(content);
  const rows = table ?? content.split(/\r?\n/).map((l) => [l]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reverb");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  saveAs(new Blob([out], { type: FORMAT_MIME.xlsx }), filename);
}

async function exportPptx(content: string, filename: string): Promise<void> {
  const PptxGenJSModule = await import("pptxgenjs");
  const PptxGenJS = (PptxGenJSModule.default ?? PptxGenJSModule) as typeof import("pptxgenjs").default;
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";

  // Split into slides: each H1/H2 starts a new slide; otherwise chunk by paragraphs.
  const lines = content.split(/\r?\n/);
  type SlideBuf = { title: string; bullets: string[] };
  const slides: SlideBuf[] = [];
  let current: SlideBuf | null = null;
  for (const raw of lines) {
    const h1 = raw.match(/^#\s+(.*)/);
    const h2 = raw.match(/^##\s+(.*)/);
    const bullet = raw.match(/^[-*+]\s+(.*)/);
    const ol = raw.match(/^\d+\.\s+(.*)/);
    if (h1 || h2) {
      if (current) slides.push(current);
      current = { title: (h1?.[1] ?? h2?.[1] ?? "").replace(/\*\*([^*]+)\*\*/g, "$1"), bullets: [] };
    } else if (bullet) {
      if (!current) current = { title: "Overview", bullets: [] };
      current.bullets.push(bullet[1].replace(/\*\*([^*]+)\*\*/g, "$1"));
    } else if (ol) {
      if (!current) current = { title: "Overview", bullets: [] };
      current.bullets.push(ol[1].replace(/\*\*([^*]+)\*\*/g, "$1"));
    } else if (raw.trim()) {
      if (!current) current = { title: "Overview", bullets: [] };
      current.bullets.push(raw.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1"));
    }
  }
  if (current) slides.push(current);
  if (slides.length === 0) slides.push({ title: "Reverb Output", bullets: [content.slice(0, 800)] });

  for (const s of slides) {
    const slide = pres.addSlide();
    slide.background = { color: "FAF6EF" };
    slide.addText(s.title, {
      x: 0.5, y: 0.4, w: 12, h: 0.9,
      fontSize: 28, bold: true, color: "1F1B16", fontFace: "Calibri",
    });
    slide.addText(
      s.bullets.length
        ? s.bullets.map((t) => ({ text: t, options: { bullet: true } }))
        : [{ text: "—" }],
      {
        x: 0.5, y: 1.5, w: 12, h: 5.5,
        fontSize: 16, color: "3A332B", fontFace: "Calibri",
        valign: "top",
      }
    );
    slide.addText("Generated by Reverb", {
      x: 0.5, y: 6.9, w: 12, h: 0.3, fontSize: 10, color: "9A8A78", italic: true,
    });
  }

  // pptxgenjs typing for writeFile doesn't match its actual return; cast minimally
  await (pres as unknown as { writeFile: (o: { fileName: string }) => Promise<string> })
    .writeFile({ fileName: filename });
}

function exportTextBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  saveAs(blob, filename);
}

function exportCsv(content: string, filename: string): void {
  const table = extractTable(content);
  const csv = table ? rowsToCsv(table) : content;
  exportTextBlob(csv, filename, FORMAT_MIME.csv);
}

function exportJson(content: string, filename: string): void {
  // If content looks like JSON, pretty-print it; else wrap as { content }
  const trimmed = content.trim();
  let out: string;
  try {
    if ((trimmed.startsWith("{") || trimmed.startsWith("["))) {
      out = JSON.stringify(JSON.parse(trimmed), null, 2);
    } else {
      out = JSON.stringify({ content }, null, 2);
    }
  } catch {
    out = JSON.stringify({ content }, null, 2);
  }
  exportTextBlob(out, filename, FORMAT_MIME.json);
}

function exportHtml(content: string, filename: string): void {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Reverb Output</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:780px;margin:40px auto;padding:0 16px;line-height:1.6;color:#1f1b16}pre{white-space:pre-wrap;word-wrap:break-word;background:#faf6ef;padding:16px;border-radius:8px}</style>
</head><body><pre>${escaped}</pre></body></html>`;
  exportTextBlob(html, filename, FORMAT_MIME.html);
}

export async function downloadAs(
  format: ExportFormat,
  content: string,
  promptHint = ""
): Promise<void> {
  const filename = buildFilename(promptHint, format);
  switch (format) {
    case "pdf":  return exportPdf(content, filename);
    case "docx": return exportDocx(content, filename);
    case "xlsx": return exportXlsx(content, filename);
    case "pptx": return exportPptx(content, filename);
    case "csv":  return exportCsv(content, filename);
    case "json": return exportJson(content, filename);
    case "md":   return exportTextBlob(content, filename, FORMAT_MIME.md);
    case "txt":  return exportTextBlob(mdToPlainText(content), filename, FORMAT_MIME.txt);
    case "html": return exportHtml(content, filename);
  }
}

// ─────────────────────────────────────────────────────────────────
// System-prompt hint sent to the LLM so it structures the output
// in a way that converts cleanly to the requested format.
// ─────────────────────────────────────────────────────────────────
export function formatInstruction(format: ExportFormat): string {
  switch (format) {
    case "pdf":
    case "docx":
      return `The user wants this exported as a ${FORMAT_LABELS[format]}. Structure the response with clear markdown headings (# / ##), short paragraphs, and bullet lists. Avoid mid-paragraph formatting that won't render well in print.`;
    case "xlsx":
    case "csv":
      return `The user wants this exported as a ${FORMAT_LABELS[format]} file. Return the answer PRIMARILY as a markdown table with a header row, so it can be parsed into rows and columns. Keep prose minimal — the table is the deliverable.`;
    case "pptx":
      return `The user wants this exported as a ${FORMAT_LABELS[format]} deck. Structure the response as 4-8 slides. Use ## for each slide title and bullet lists for slide body. Keep each slide focused on one idea.`;
    case "json":
      return `The user wants this exported as JSON. Return a single, well-structured JSON object or array as the primary content. Use code fences only if necessary — pure JSON is preferred.`;
    case "md":
      return `The user wants this as a Markdown file. Use rich markdown formatting: headings, bullets, tables, bold, links.`;
    case "html":
      return `The user wants this as an HTML file. Structure with clear headings and paragraphs.`;
    case "txt":
      return `The user wants this as plain text. Avoid markdown syntax — write in clean prose with blank lines between paragraphs.`;
  }
}
