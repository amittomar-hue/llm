import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 300;

type AssetType =
  | "article" | "whitepaper" | "ebook" | "playbook" | "case_study"
  | "social_post" | "ad_campaign" | "report" | "newsletter" | "podcast"
  | "video" | "template" | "guide";

interface QAPair {
  instruction: string;
  output: string;
}

// ─────────────────────────────────────────────────────────────────
// Asset-type-aware prompts. Each prompt tunes the angle, voice, and
// shape of the Q&A pairs so Reverb learns the *right kind of marketing
// answer* for each artifact (a social-post breakdown sounds nothing
// like an ABM whitepaper analysis).
// ─────────────────────────────────────────────────────────────────
const PROMPTS: Record<AssetType, string> = {
  article: `You are generating training data for Reverb — a marketing LLM. From the article excerpt, produce 3 instruction-tuning Q&A pairs.
- "instruction": realistic marketing-team question (~10-25 words).
- "output": direct markdown answer grounded ONLY in the article. ~150-400 words.
- Cover 3 different angles: tactical, strategic, analytical.
Return ONLY a valid JSON array. No prose.`,

  whitepaper: `You are generating training data for Reverb from a marketing whitepaper. Produce 3 Q&A pairs that emphasize evidence, benchmarks, and research-backed claims.
- "instruction": question a marketing strategist would ask when validating an approach (~10-25 words).
- "output": cite the whitepaper's specific data points, benchmarks, or research framework. Use markdown with bullets. ~200-400 words.
- One pair MUST surface a benchmark or stat. One pair MUST surface a research framework.
Return ONLY a valid JSON array. No prose.`,

  ebook: `You are generating training data for Reverb from an ebook excerpt. Produce 3 Q&A pairs that teach the ebook's full mental model.
- "instruction": question a marketer would ask while reading the ebook (~10-25 words).
- "output": markdown answer with structured sections (## Step / ## Framework / ## Example). ~250-450 words.
- Pairs should cover: (1) the core framework, (2) a tactical application, (3) a common pitfall the ebook warns against.
Return ONLY a valid JSON array. No prose.`,

  playbook: `You are generating training data for Reverb from a marketing playbook. Produce 3 Q&A pairs that are TACTICAL and OPERATIONAL.
- "instruction": "How do I…" or "What's the step-by-step…" style question (~10-25 words).
- "output": numbered steps with concrete actions, tools, timeframes. Use markdown. ~200-400 words.
- Every pair MUST contain a numbered or bulleted step sequence the user can execute today.
Return ONLY a valid JSON array. No prose.`,

  case_study: `You are generating training data for Reverb from a marketing case study. Produce 3 Q&A pairs that teach pattern-matching from real outcomes.
- "instruction": question framing the situation OR asking what worked (~10-25 words).
- "output": markdown answer with **Situation / Approach / Result** sections. Include specific metrics (%, $, lift) wherever the source mentions them. ~200-400 words.
- One pair MUST surface the headline result/metric. One pair MUST extract the transferable lesson.
Return ONLY a valid JSON array. No prose.`,

  social_post: `You are generating training data for Reverb from a high-performing marketing social post. Produce 3 Q&A pairs that teach the *craft* of the post.
- "instruction": question about hook, structure, voice, or virality drivers (~10-25 words).
- "output": short, punchy markdown answer. Break down the post's hook, narrative shape, CTA. Include the verbatim hook or key line in a > blockquote. ~120-300 words.
- One pair MUST be a "rewrite this for [different audience]" style example.
Return ONLY a valid JSON array. No prose.`,

  ad_campaign: `You are generating training data for Reverb from an ad campaign breakdown. Produce 3 Q&A pairs that teach campaign craft.
- "instruction": question about creative concept, targeting, message, or results (~10-25 words).
- "output": markdown sections covering **Insight / Creative / Channel / Result**. ~200-400 words.
- One pair MUST extract the core consumer/buyer insight. One pair MUST surface the channel + format choice and why.
Return ONLY a valid JSON array. No prose.`,

  report: `You are generating training data for Reverb from an industry report. Produce 3 Q&A pairs that surface benchmarks and strategic implications.
- "instruction": question a CMO or marketing director would ask of the report (~10-25 words).
- "output": markdown answer leading with the headline number, then **What it means** and **What to do**. ~200-400 words.
- Every pair MUST cite a number or benchmark from the report.
Return ONLY a valid JSON array. No prose.`,

  newsletter: `You are generating training data for Reverb from a marketing newsletter issue. Produce 3 Q&A pairs that capture the news + the so-what.
- "instruction": "What happened with…" or "Why does X matter for marketers" (~10-25 words).
- "output": tight markdown answer: 1-sentence summary, then bullet implications. ~120-250 words.
- Bias toward recency: treat the newsletter as the source of truth on *this week's* development.
Return ONLY a valid JSON array. No prose.`,

  podcast: `You are generating training data for Reverb from podcast show notes/transcript. Produce 3 Q&A pairs that surface guest expertise.
- "instruction": question the host would ask, or a listener would search for (~10-25 words).
- "output": markdown answer in the *guest's voice/POV* where the transcript supports it, with their key takeaway and supporting reasoning. ~200-400 words.
Return ONLY a valid JSON array. No prose.`,

  video: `You are generating training data for Reverb from a webinar or video transcript. Produce 3 Q&A pairs grounded in what was said.
- "instruction": realistic marketing question (~10-25 words).
- "output": markdown answer summarizing the speaker's argument with at least one near-verbatim quote in a > blockquote. ~200-400 words.
Return ONLY a valid JSON array. No prose.`,

  template: `You are generating training data for Reverb from a marketing template/framework. Produce 3 Q&A pairs that teach how to USE the template.
- "instruction": "How do I fill out…" or "What goes in section X" style (~10-25 words).
- "output": markdown answer with the template fields/sections, what each one captures, and an example. ~200-400 words.
- One pair MUST show a fully filled-in example.
Return ONLY a valid JSON array. No prose.`,

  guide: `You are generating training data for Reverb from a long-form how-to guide. Produce 3 Q&A pairs that teach end-to-end execution.
- "instruction": "How do I…" or "What's the complete approach to…" (~10-25 words).
- "output": markdown answer with ## sections covering the guide's progression. ~250-450 words.
- Pairs should ladder up from beginner → intermediate → advanced where the source supports it.
Return ONLY a valid JSON array. No prose.`,
};

function pickPrompt(asset_type: string | null | undefined): string {
  const k = (asset_type ?? "article") as AssetType;
  return PROMPTS[k] ?? PROMPTS.article;
}

// ─────────────────────────────────────────────────────────────────
// WizardLM-style evol-instruct. After the initial pair is generated
// from the scraped artifact, each pair is evolved 3 ways:
//   - specific:  rewritten for a specific industry/segment context
//   - tactical:  made more operational (named tools, exact steps, timing)
//   - strategic: lifted to budget/tradeoff/portfolio framing
//
// Cost: 3 extra Groq calls per original pair. At 50 originals × 4 cron
// runs/day = 200/day × 3 = 600 extra calls. 8B-instant has 14,400 RPD
// on free tier, so headroom is fine. Each evolved pair gets parent_pair_id
// + evolution_kind set so admin can audit augmentation quality.
// ─────────────────────────────────────────────────────────────────

type EvolutionKind = "specific" | "tactical" | "strategic";

const EVOLUTION_PROMPTS: Record<EvolutionKind, string> = {
  specific: `You are evolving a marketing training pair to be MORE SPECIFIC. Rewrite the Q&A so it targets a concrete industry segment (B2B SaaS, retail, fintech, healthcare, or DTC e-commerce — pick the one that fits the original best). Keep the same teaching intent. The new instruction should name the segment; the new output should reference industry-specific tactics, named platforms, and segment-typical metrics. Return ONLY the JSON object {"instruction": "...", "output": "..."}. No prose.`,

  tactical: `You are evolving a marketing training pair to be MORE TACTICAL and OPERATIONAL. Rewrite the Q&A so the answer becomes a step-by-step execution plan the user can run with their OWN stack.

WHAT GOOD LOOKS LIKE:
- Instruction asks "how do I execute…", "what's the step-by-step…", or "walk me through…".
- Answer is numbered or week-based steps. Each step has a concrete action the user takes in THEIR own marketing stack.
- Where useful, name one or two tools the user might use (HubSpot, GA4, 6sense, Mutiny, Apollo, Outreach, Clearbit, etc) — but generic phrasing like "your CRM" or "your analytics platform" is also fine. Don't force-fit tools when the step is platform-agnostic.
- Timeline (days/weeks/sprints) and success thresholds are nice-to-have, not required.

HARD RULES:
- NEVER tell the user to download an external whitepaper, ebook, or PDF — steps are actions in their own stack, not content-consumption.
- NEVER reference "the source article" or imply Reverb owns the source material. Do NOT use phrases like "from the [vendor] content hub" or "log in to HubSpot to download our…".
- If the original pair was a "where to find X" question, replace it with "how to do X" — turn information-retrieval into execution.

Return ONLY the JSON object {"instruction": "...", "output": "..."}. No prose.`,

  strategic: `You are evolving a marketing training pair to be MORE STRATEGIC. Rewrite the Q&A so it ladders up to budget tradeoffs, portfolio prioritization, channel mix decisions, or CMO-level resource allocation. The instruction should sound like a CMO/VP question; the output should compare options with TAM/CAC/payback logic and recommend a default with caveats. Return ONLY the JSON object {"instruction": "...", "output": "..."}. No prose.`,
};

// ─────────────────────────────────────────────────────────────────
// Robust JSON extractor for LLM evolution responses. The previous greedy
// regex `/\{[\s\S]*\}/` + raw JSON.parse failed silently when the model
// produced common malformations:
//   - smart quotes ("…") instead of straight ("…")
//   - literal newlines inside JSON string values (tactical's numbered steps)
//   - markdown fences ```json …``` wrapping the object
//   - trailing prose after the closing brace
// That was killing the entire tactical lens (0 pairs/24h since prompt
// relaxation). This walker counts braces with proper string/escape
// awareness to find the first complete JSON object, then escapes raw
// newlines inside its strings before parsing.
// ─────────────────────────────────────────────────────────────────
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;
  let candidate = raw.slice(start, end + 1)
    .replace(/[“”]/g, '"')   // smart double quotes → straight
    .replace(/[‘’]/g, "'");  // smart single quotes → straight
  // Escape raw \n / \r / \t inside JSON strings — model often emits
  // multi-line numbered steps as raw newlines, which break JSON.parse.
  let out = "";
  inString = false;
  escaped = false;
  for (const c of candidate) {
    if (escaped) { out += c; escaped = false; continue; }
    if (c === "\\") { out += c; escaped = true; continue; }
    if (c === '"') { inString = !inString; out += c; continue; }
    if (inString) {
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
    }
    out += c;
  }
  candidate = out;
  return candidate;
}

function tryParseQAPair(raw: string): QAPair | null {
  if (!raw) return null;
  const candidate = extractJsonObject(raw);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as QAPair;
  } catch {
    return null;
  }
}

// Source-leakage detector — catches phrases that imply Reverb owns the
// scraped source ("download our whitepaper", "log in to HubSpot to find…").
// Used at INSERT time to immediately downgrade quality below the 0.7
// retrieval floor instead of relying on periodic SQL cleanups.
const LEAKAGE_PATTERNS = [
  /\bdownload our (?:whitepaper|ebook|report|guide|template|case study)\b/i,
  /\bour (?:whitepaper|ebook|report|content hub)\b/i,
  /\bfrom (?:the |our )?(?:[a-z]+ )?content hub\b/i,
  /\blog in to [a-z][a-z0-9 ]{2,30}? (?:download|access|find|search for)\b/i,
  /\bsearch for the (?:whitepaper|ebook|report)\b/i,
  /\bnavigate to (?:our|the [a-z]+ )?content hub\b/i,
  /\baccess (?:our|the full) (?:whitepaper|ebook|report|guide)\b/i,
  /\bdownload the (?:full )?(?:whitepaper|ebook|report) (?:here|now|today)\b/i,
];

function containsSourceLeakage(text: string | null | undefined): boolean {
  if (!text) return false;
  return LEAKAGE_PATTERNS.some((re) => re.test(text));
}

async function evolveOnce(
  groq: OpenAI,
  kind: EvolutionKind,
  asset_type: string,
  category: string,
  original: QAPair
): Promise<QAPair | null> {
  try {
    const systemPrompt = EVOLUTION_PROMPTS[kind];
    const userPrompt = `Original training pair (asset_type=${asset_type}, category=${category}):

Q: ${original.instruction}

A: ${original.output.slice(0, 1400)}

Evolve it per the system prompt and return the new pair as a JSON object.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      // Bumped 1400 → 2000 so longer multi-step tactical answers don't
      // get truncated mid-JSON (which silently dropped tactical pairs to 0).
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const obj = tryParseQAPair(text);
    if (!obj) return null;
    if (
      typeof obj.instruction !== "string" ||
      typeof obj.output !== "string" ||
      obj.instruction.length < 15 ||
      obj.output.length < 200
    ) {
      return null;
    }
    return obj;
  } catch {
    // Best-effort — a failed evolution shouldn't take down the cron run
    return null;
  }
}

async function generatePairs(
  groq: OpenAI,
  asset_type: string | null | undefined,
  category: string,
  title: string,
  summary: string
): Promise<QAPair[]> {
  const systemPrompt = pickPrompt(asset_type);
  const userPrompt = `Asset type: ${asset_type ?? "article"}
Marketing category: ${category}
Source title: ${title}

Source excerpt:
${summary}

Generate 3 training Q&A pairs in the required JSON format.`;

  // 8B-instant: 5× the free-tier TPD quota of 70B (500K vs 100K).
  // The bottleneck is daily throughput, not single-call quality.
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.65,
    max_tokens: 2000,
  });

  const text = response.choices[0]?.message?.content ?? "";
  // The originals are returned as a JSON ARRAY of pairs, not a single object.
  // Same parse risks apply (smart quotes, raw newlines inside step lists);
  // we use the same brace-aware/quote-aware fallback after a direct attempt.
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];
  let pairs: QAPair[] = [];
  try {
    pairs = JSON.parse(arrayMatch[0]) as QAPair[];
  } catch {
    // Fallback: walk the array element-by-element using the object extractor.
    // The JSON.parse of the whole array can fail if just ONE entry has a raw
    // newline; this rescues the surviving entries.
    const recovered: QAPair[] = [];
    let cursor = 0;
    const body = arrayMatch[0];
    while (cursor < body.length) {
      const rest = body.slice(cursor);
      const candidate = tryParseQAPair(rest);
      if (!candidate) break;
      recovered.push(candidate);
      // Skip past this object by re-locating the next `{` after the current one
      const nextOpen = body.indexOf("{", cursor + 1);
      if (nextOpen < 0) break;
      cursor = nextOpen;
    }
    pairs = recovered;
  }
  // Quality floor: instructions >= 15 chars, outputs >= 200 chars.
  return pairs.filter(
    (p) => typeof p.instruction === "string" && typeof p.output === "string" &&
           p.instruction.length > 15 && p.output.length >= 200
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return NextResponse.json({ error: "GROQ_API_KEY missing" }, { status: 503 });

  const supa = getSupabase();
  if (!supa) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const url = req.nextUrl;
  // Evolution turns each scraped item into ~12 pairs (3 originals × 4 incl.
  // self). Default lowered to 12 so each run fits within 300s maxDuration
  // even with the parallel evolution. ?limit=N to override.
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "12", 10), 30);
  const assetFilter = url.searchParams.get("asset_type");

  const { data: runRow } = await supa
    .from("conversion_runs")
    .insert({})
    .select("id")
    .single();
  const runId = runRow?.id;

  let query = supa
    .from("marketing_intel")
    .select("id, category, asset_type, title, url, summary")
    .eq("converted_to_training", false)
    .not("summary", "is", null)
    .gte("scraped_at", new Date(Date.now() - 60 * 86400000).toISOString())
    .order("scraped_at", { ascending: false })
    .limit(limit);
  if (assetFilter) query = query.eq("asset_type", assetFilter);

  const { data: intelRows } = await query;

  // Evolution can be disabled via ?evolve=0 for cost-control or debugging
  const evolveEnabled = url.searchParams.get("evolve") !== "0";

  const rows = intelRows ?? [];
  let pairsCreated = 0;
  let pairsSkipped = 0;
  let evolvedCreated = 0;
  let evolvedSkipped = 0;
  const byAsset: Record<string, number> = {};

  for (const row of rows) {
    try {
      const summary = (row.summary ?? "").slice(0, 1500);
      if (summary.length < 200) {
        pairsSkipped++;
        continue;
      }
      const pairs = await generatePairs(groq, row.asset_type, row.category, row.title, summary);
      const assetType = row.asset_type ?? "article";
      for (const p of pairs) {
        // Server-side leakage guard: if the model emitted phrases like
        // "download our whitepaper" or "log in to HubSpot to find…", the
        // pair gets inserted with quality=0.5 so the retrieve RPC's 0.7
        // floor skips it. Was previously cleaned via periodic SQL — now
        // it's prevented at write time.
        const originalQuality = containsSourceLeakage(p.output) ? 0.5 : 1.0;
        const { data: inserted, error } = await supa
          .from("training_pairs")
          .insert({
            intel_id: row.id,
            intent: row.category,
            asset_type: assetType,
            instruction: p.instruction,
            output: p.output,
            source_url: row.url,
            source_title: row.title,
            quality: originalQuality,
            is_evolved: false,
          })
          .select("id")
          .single();

        if (!error) {
          pairsCreated++;
          byAsset[assetType] = (byAsset[assetType] ?? 0) + 1;

          // EVOLUTION PASS — 3 variants (specific / tactical / strategic).
          // Fire the 3 evolution Groq calls in PARALLEL — Groq's free-tier
          // RPM is 30 which we'll never hit; keeps per-row latency to ~3-5s
          // instead of ~10-15s sequential. Then DB-insert sequentially.
          if (evolveEnabled && inserted?.id) {
            const parentId = inserted.id as string;
            const kinds: EvolutionKind[] = ["specific", "tactical", "strategic"];
            const evolvedResults = await Promise.all(
              kinds.map((k) => evolveOnce(groq, k, assetType, row.category, p))
            );
            for (let i = 0; i < kinds.length; i++) {
              const evolved = evolvedResults[i];
              if (!evolved) { evolvedSkipped++; continue; }
              // Same leakage guard on evolved pairs — evolutions are more
              // likely to absorb source-doc voice from the parent if the LLM
              // forgets the HARD RULES in the prompt.
              const evQuality = containsSourceLeakage(evolved.output) ? 0.5 : 0.85;
              const { error: evErr } = await supa.from("training_pairs").insert({
                intel_id: row.id,
                intent: row.category,
                asset_type: assetType,
                instruction: evolved.instruction,
                output: evolved.output,
                source_url: row.url,
                source_title: row.title,
                quality: evQuality, // 0.85 for clean, 0.5 if leakage detected
                is_evolved: true,
                parent_pair_id: parentId,
                evolution_kind: kinds[i],
              });
              if (!evErr) evolvedCreated++;
              else evolvedSkipped++;
            }
          }
        }
      }
      await supa
        .from("marketing_intel")
        .update({ converted_to_training: true })
        .eq("id", row.id);
    } catch (err) {
      console.error("convert pair error:", err);
      pairsSkipped++;
    }
  }

  if (runId) {
    await supa
      .from("conversion_runs")
      .update({
        finished_at: new Date().toISOString(),
        intel_processed: rows.length,
        pairs_created: pairsCreated,
        pairs_skipped: pairsSkipped,
      })
      .eq("id", runId);
  }

  return NextResponse.json({
    ok: true,
    run_id: runId,
    intel_processed: rows.length,
    pairs_created: pairsCreated,
    pairs_skipped: pairsSkipped,
    evolution_enabled: evolveEnabled,
    evolved_pairs_created: evolvedCreated,
    evolved_pairs_skipped: evolvedSkipped,
    total_pairs_added: pairsCreated + evolvedCreated,
    by_asset: byAsset,
  });
}
