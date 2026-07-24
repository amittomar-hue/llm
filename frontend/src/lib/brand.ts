import { getSupabase } from "./supabase";

interface BrandChunk {
  chunk_id: string;
  doc_id: string;
  filename: string;
  doc_type: string;
  text: string;
  similarity: number;
}

/**
 * Split long text into overlapping chunks for retrieval.
 * Default: 1000-char chunks with 150-char overlap, prefer paragraph breaks.
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
  if (!text) return [];
  const cleaned = text.replace(/\r\n/g, "\n").trim();

  // Split on paragraph breaks first
  const paragraphs = cleaned.split(/\n{2,}/);
  const chunks: string[] = [];
  let buffer = "";

  for (const p of paragraphs) {
    if ((buffer + "\n\n" + p).length <= chunkSize) {
      buffer = buffer ? `${buffer}\n\n${p}` : p;
      continue;
    }
    if (buffer) chunks.push(buffer);
    if (p.length <= chunkSize) {
      buffer = p;
    } else {
      // Single paragraph is too long — slice with overlap
      let i = 0;
      while (i < p.length) {
        chunks.push(p.slice(i, i + chunkSize));
        i += chunkSize - overlap;
      }
      buffer = "";
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.filter((c) => c.trim().length > 50);
}

export async function retrieveBrandChunks(
  userId: string,
  query: string,
  limit = 5,
  agentId: string | null = null
): Promise<BrandChunk[]> {
  const supa = getSupabase();
  if (!supa || !query || query.length < 3) return [];

  // p_agent_id NULL → RPC falls back to the user's default agent so
  // legacy callers (and any conversation without an explicit agent
  // binding) keep working without breaking.
  const { data, error } = await supa.rpc("retrieve_brand_chunks", {
    p_user_id: userId,
    p_agent_id: agentId,
    p_query: query.slice(0, 500),
    p_limit: limit,
  });
  if (error) {
    console.error("retrieveBrandChunks error:", error.message);
    return [];
  }
  const hits = (data as BrandChunk[] | null) ?? [];
  if (hits.length > 0) return hits;

  // ── Fallback: recency-based retrieval ────────────────────────────
  // The RPC filters on trigram similarity > 0.05 which is too strict
  // for short/generic user queries ("create the h2 roadmap") against
  // 1000-char chunks — the RPC returns empty, brand context is empty,
  // and the model falls back to citing external training-pair URLs
  // (the "why isn't my brand agent being used?" bug).
  //
  // When the similarity path yields nothing, we fall back to the top-N
  // most recent chunks for the agent. Some brand grounding is always
  // better than none.
  let fallbackAgentId = agentId;
  if (!fallbackAgentId) {
    const { data: defaultAgent } = await supa
      .from("brand_agents")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    fallbackAgentId = (defaultAgent?.id as string | undefined) ?? null;
  }
  if (!fallbackAgentId) return [];

  const { data: fallbackRows, error: fallbackErr } = await supa
    .from("brand_doc_chunks")
    .select("id, doc_id, text, brand_documents!inner(filename, doc_type)")
    .eq("user_id", userId)
    .eq("agent_id", fallbackAgentId)
    .order("chunk_index", { ascending: true })
    .limit(limit);

  if (fallbackErr || !fallbackRows) return [];

  type FallbackRow = {
    id: string;
    doc_id: string;
    text: string;
    brand_documents: { filename: string; doc_type: string } | { filename: string; doc_type: string }[];
  };
  return (fallbackRows as FallbackRow[]).map((r) => {
    const bd = Array.isArray(r.brand_documents) ? r.brand_documents[0] : r.brand_documents;
    return {
      chunk_id: r.id,
      doc_id: r.doc_id,
      filename: bd?.filename ?? "(unknown)",
      doc_type: bd?.doc_type ?? "general",
      text: r.text,
      similarity: 0, // marker: recency fallback, not similarity match
    };
  });
}

interface TemplateDoc {
  id: string;
  filename: string;
  text: string;
  char_count: number;
}

/**
 * Pull ALL `template`-typed brand documents for a given agent and reconstruct
 * full text by concatenating chunks in order. Bypasses the similarity-search
 * RPC because templates are structural references — we want the WHOLE doc to
 * teach the model the section shape, not just chunks that match a query.
 *
 * Each doc is capped at maxCharsPerDoc to protect TPM budget — for a 30-page
 * plan that's ~30K chars after cap (vs ~75K raw), enough to convey structure
 * + density without choking a 12K-TPM model.
 */
export async function retrieveTemplateDocs(
  userId: string,
  agentId: string | null,
  maxCharsPerDoc = 30_000
): Promise<TemplateDoc[]> {
  const supa = getSupabase();
  if (!supa) return [];

  // Resolve the actual agent. If no agent_id was passed, fall back to the
  // user's default agent so the template still attaches to /chat sessions
  // without an explicit binding.
  let effectiveAgentId = agentId;
  if (!effectiveAgentId) {
    const { data: defaultAgent } = await supa
      .from("brand_agents")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    effectiveAgentId = (defaultAgent?.id as string | undefined) ?? null;
  }
  if (!effectiveAgentId) return [];

  const { data: docs, error } = await supa
    .from("brand_documents")
    .select("id, filename, char_count:total_chars")
    .eq("user_id", userId)
    .eq("agent_id", effectiveAgentId)
    .eq("doc_type", "template")
    .order("uploaded_at", { ascending: false });

  if (error || !docs || docs.length === 0) return [];

  // Fetch all chunks for these template docs in one round-trip, then
  // reassemble per doc.
  const docIds = docs.map((d) => d.id as string);
  const { data: chunks, error: chErr } = await supa
    .from("brand_doc_chunks")
    .select("doc_id, chunk_index, text")
    .in("doc_id", docIds)
    .order("chunk_index", { ascending: true });

  if (chErr || !chunks) return [];

  const textByDocId = new Map<string, string>();
  for (const c of chunks) {
    const id = c.doc_id as string;
    const prev = textByDocId.get(id) ?? "";
    textByDocId.set(id, prev + (prev ? "\n" : "") + (c.text as string));
  }

  return docs.map((d) => {
    const full = textByDocId.get(d.id as string) ?? "";
    const trimmed = full.length > maxCharsPerDoc
      ? full.slice(0, maxCharsPerDoc) + "\n…[template truncated for token budget]"
      : full;
    return {
      id: d.id as string,
      filename: d.filename as string,
      text: trimmed,
      char_count: trimmed.length,
    };
  });
}

/**
 * Format template docs as a single system-prompt block. Marked as
 * STRUCTURAL TEMPLATE so the model knows to mimic the shape, not the
 * literal content.
 */
export function formatTemplatesForContext(docs: TemplateDoc[]): string {
  if (docs.length === 0) return "";
  const lines = [
    "STRUCTURAL TEMPLATE(S) — The user has uploaded the following reference document(s) as the SHAPE/DENSITY/STRUCTURE they want this output to match. Mirror their section structure (number, naming, ordering), table count, depth of each section, voice register, and formatting conventions. ADAPT the named entities, numbers, and examples to the user's actual brand (per BRAND IDENTITY and brand documents), but produce a document of comparable length and density to these references.",
    "",
  ];
  docs.forEach((d, i) => {
    lines.push(`═══ TEMPLATE ${i + 1}: "${d.filename}" (${d.char_count.toLocaleString()} chars) ═══`);
    lines.push(d.text);
    lines.push("");
  });
  return lines.join("\n");
}

export function formatBrandContext(chunks: BrandChunk[]): string {
  if (chunks.length === 0) return "";

  const lines = [
    "USER'S BRAND DOCUMENTS — Use these as the source of truth for the user's brand voice, products, customers, and positioning. Treat anything here as authoritative about THEIR brand and adapt your response style + claims accordingly.",
    "",
  ];

  chunks.forEach((c, i) => {
    const sim = (c.similarity * 100).toFixed(0);
    lines.push(`[Brand-${i + 1}] from "${c.filename}" (${c.doc_type.replace("_", " ")}) — relevance ${sim}%`);
    lines.push(c.text.slice(0, 1500));
    lines.push("");
  });

  return lines.join("\n");
}

export const DOC_TYPES = [
  // Templates get special treatment in the chat route: when a strategic-plan
  // request fires, ALL template docs for the active agent are injected WHOLE
  // (not chunked by similarity) so the model can mimic their structure,
  // depth, and density. Upload a past 30-page execution plan, board deck
  // outline, or campaign brief here to teach Reverb the shape of long-form
  // output you want. Listed first so it's discoverable.
  { value: "template",         label: "Structural template (for long-form plans)" },
  { value: "brand_guidelines", label: "Brand guidelines" },
  { value: "style_guide",      label: "Style / voice guide" },
  { value: "product_info",     label: "Product info / datasheet" },
  { value: "messaging",        label: "Messaging framework" },
  { value: "personas",         label: "ICP / personas" },
  { value: "case_study",       label: "Case study / past campaign" },
  { value: "sales_playbook",   label: "Sales playbook" },
  { value: "positioning",      label: "Positioning / competitive" },
  { value: "company_story",    label: "Company story / about" },
  { value: "general",          label: "Other / general" },
];

// ─────────────────────────────────────────────────────────────────
// Auto-classifier for the upload flow on /brand. Runs entirely in the
// browser after parseDocumentClient extracts the text. Scores each
// DOC_TYPES value against a small dictionary of filename + content
// keywords (filename hits weighted 3× since filenames carry intent)
// and returns the top scorer, falling back to "general" on a tie or
// zero matches. Conservative on purpose — when in doubt, defer to
// the user; the dropdown stays available as an override.
// ─────────────────────────────────────────────────────────────────

const TYPE_SIGNALS: Record<string, { filenamePatterns: RegExp[]; contentKeywords: string[] }> = {
  brand_guidelines: {
    filenamePatterns: [/\bbrand[-_\s]?(book|guide|guideline|kit)/i, /\bidentity\b/i, /\bguidelines?\b/i],
    contentKeywords: ["brand guidelines", "logo usage", "color palette", "brand book", "visual identity", "brand standards", "primary color", "typography"],
  },
  style_guide: {
    filenamePatterns: [/\b(style|voice|tone)[-_\s]?guide/i, /\bstyleguide\b/i, /\btov\b/i],
    contentKeywords: ["tone of voice", "we sound like", "we don't sound like", "voice and tone", "writing style", "vocabulary", "avoid these words", "preferred terms"],
  },
  product_info: {
    filenamePatterns: [/\bdatasheet\b/i, /\bspec(s|sheet)\b/i, /\bproduct[-_\s]?(info|sheet|overview|brief)/i, /\bfeatures?\b/i],
    contentKeywords: ["product overview", "key features", "specifications", "technical specs", "supported formats", "system requirements", "feature list", "capabilities"],
  },
  messaging: {
    filenamePatterns: [/\bmessag(ing|e)\b/i, /\bvalue[-_\s]?prop/i, /\b(narrative|story)[-_\s]?framework/i],
    contentKeywords: ["value proposition", "key messages", "messaging framework", "core message", "elevator pitch", "tagline", "proof points", "messaging pillars"],
  },
  personas: {
    filenamePatterns: [/\bpersona/i, /\bicp\b/i, /\bbuyer[-_\s]?(profile|persona)/i, /\baudience\b/i],
    contentKeywords: ["target customer", "buyer persona", "ideal customer profile", "demographics", "job title", "pain points", "decision maker", "user persona"],
  },
  case_study: {
    filenamePatterns: [/\bcase[-_\s]?stud/i, /\bsuccess[-_\s]?story/i, /\bcustomer[-_\s]?story/i, /\bcampaign\b/i, /\btestimonial/i],
    contentKeywords: ["challenge", "the solution", "results", "outcome", "before and after", "customer success", "increased by", "% improvement", "case study", "the customer"],
  },
  sales_playbook: {
    filenamePatterns: [/\bplaybook\b/i, /\bsales[-_\s]?(deck|enablement|script)/i, /\boutreach\b/i, /\bcadence\b/i],
    contentKeywords: ["sales playbook", "qualification framework", "objection handling", "discovery questions", "next steps", "outreach sequence", "call script", "BANT", "MEDDIC"],
  },
  positioning: {
    filenamePatterns: [/\bpositioning\b/i, /\bcompetit/i, /\bvs[-_\s]?(competitor|alternative)/i, /\bdifferentia/i],
    contentKeywords: ["competitive positioning", "vs competitor", "differentiation", "unlike alternatives", "category leader", "market positioning", "competitive advantage", "our edge"],
  },
  company_story: {
    filenamePatterns: [/\babout[-_\s]?(us|company)/i, /\bcompany[-_\s]?(story|history|overview)/i, /\bmanifesto\b/i, /\bmission\b/i],
    contentKeywords: ["our mission", "our vision", "founded in", "company history", "our story", "we believe", "our values", "why we exist", "our purpose"],
  },
};

/** Classify a brand document into one of the DOC_TYPES values based on
 *  filename + content signals. Returns "general" if no signal scores
 *  above zero, or if multiple types tie. */
export function classifyDocType(filename: string, text: string): string {
  const name = filename.toLowerCase();
  // Limit content scan to the first 8K chars — enough signal for any
  // real brand doc, keeps the regex pass under 1ms for huge files.
  const head = text.slice(0, 8000).toLowerCase();

  const scores: { type: string; score: number }[] = [];
  for (const [type, signals] of Object.entries(TYPE_SIGNALS)) {
    let score = 0;
    for (const pattern of signals.filenamePatterns) {
      if (pattern.test(name)) score += 3; // filename hits weighted higher
    }
    for (const kw of signals.contentKeywords) {
      if (head.includes(kw)) score += 1;
    }
    if (score > 0) scores.push({ type, score });
  }

  if (scores.length === 0) return "general";
  scores.sort((a, b) => b.score - a.score);
  // Tie at the top → defer to user, return general
  if (scores.length > 1 && scores[0].score === scores[1].score) return "general";
  return scores[0].type;
}
