import { getSupabase } from "./supabase";

export interface TrainingPair {
  id: string;
  intent: string;
  asset_type: string;
  instruction: string;
  output: string;
  source_url: string | null;
  source_title: string | null;
  similarity: number;
  composite_score: number;
}

/**
 * Retrieve the top-N highest-relevance training pairs from the continuously-
 * scraped marketing knowledge base. This is the Tuned model's PRIMARY signal —
 * the asset-type-aware, quality-filtered, source-cited Q&A pairs produced by
 * the scrape-intel → convert-pairs pipeline.
 *
 * Each pair carries the original source URL so the model can cite where the
 * knowledge came from.
 */
export async function retrieveTrainingPairs(
  query: string,
  intent: string,
  limit = 5
): Promise<TrainingPair[]> {
  const supa = getSupabase();
  if (!supa || !query || query.length < 3) return [];

  const { data, error } = await supa.rpc("retrieve_training_pairs_for_chat", {
    p_query: query.slice(0, 500),
    p_intent: intent,
    p_limit: limit,
  });
  if (error) {
    // Most likely cause: RPC not deployed yet. Fail soft so the chat still works.
    console.error("retrieveTrainingPairs error:", error.message);
    return [];
  }
  return (data as TrainingPair[] | null) ?? [];
}

/**
 * Format training pairs as the Tuned model's primary system context.
 * Heavily annotated so the model knows these are CURATED EXEMPLARS from
 * a continuously-updated marketing knowledge base, not just retrieval hits.
 */
export function formatTrainingPairsAsContext(pairs: TrainingPair[]): string {
  if (pairs.length === 0) return "";

  // Tight format — every char here lands in the request and counts against TPM.
  // Header is ~150 chars instead of 700. Each pair payload is capped at 500.
  const lines = ["Reverb TUNED — KNOWLEDGE BASE (top pairs from your scraped corpus):", ""];

  pairs.forEach((p, i) => {
    lines.push(`[#${i + 1}] ${p.intent}/${p.asset_type} — Q: ${p.instruction.slice(0, 140)}`);
    if (p.source_url) lines.push(`src: ${p.source_url}`);
    lines.push(p.output.slice(0, 500));
    lines.push("");
  });

  return lines.join("\n");
}
