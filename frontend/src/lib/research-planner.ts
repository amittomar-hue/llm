// ─────────────────────────────────────────────────────────────────
// Research planner — first leg of the "think like a human" chat
// flow. Before the main answer-generation model runs, a fast Groq
// 8B-instant pass reads the user's prompt + conversation context
// and produces a small structured plan: the core intent the user
// is really after, plus 2-4 research steps the system should run
// to ground the answer. Each step is one of:
//   • intent          — distills what the user actually wants (always first)
//   • web_search      — runs a targeted Exa/Tavily query for fresh sources
//   • brand_voice     — confirms the agent's brand context is loaded
//   • training_pairs  — confirms the Tuned corpus is being consulted
//
// The plan is streamed to the client as research_step markers BEFORE
// the main answer so users see the reasoning happen — same UX shape
// as Perplexity's Pro mode or Claude's extended thinking. The chat
// route then executes the web_search steps in parallel and feeds
// the synthesised findings into the main answer call.
// ─────────────────────────────────────────────────────────────────

import OpenAI from "openai";

export type ResearchStepKind = "intent" | "web_search" | "brand_voice" | "training_pairs";

export interface ResearchStep {
  /** One of the four kinds. UI styles + the route's executor switch on this. */
  kind: ResearchStepKind;
  /** Human-readable label shown in the visible thinking trace
   *  (e.g. "Pulling recent ABM benchmark reports"). */
  label: string;
  /** For web_search steps: the actual query to send to the search provider.
   *  For other kinds: unused. */
  query?: string;
  /** Populated after execution. For web_search: source URL hostnames.
   *  For intent: the distilled intent string. Unused for brand_voice / training_pairs. */
  result?: string;
}

export interface ResearchPlan {
  /** One-line description of what the user really wants. Drives the UI's
   *  "Considering: …" header and gets injected into the final-answer
   *  system prompt as a north star for the model. */
  intent: string;
  steps: ResearchStep[];
}

const PLANNER_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are the inner voice of a senior marketing strategist who thinks out loud before answering. Read the user's question and produce a JSON plan that captures how a thoughtful human would actually approach it — what they'd want to understand, what they'd check, what they'd want to confirm — NOT a checklist of tasks for a bot.

Return JSON with two fields:

  intent  — ONE sentence that INTERPRETS what the user actually needs. Don't restate their question. Name the implicit constraint, the audience, the thing-behind-the-thing. A human would write: "You want a cold email that lands with a fintech CFO at a Series B SaaS — without sounding like every other vendor in their inbox." NOT "Draft a cold email."
  steps   — array of 2-4 thoughts, in the order they'd naturally occur.

Each step:
  { "kind": "web_search" | "brand_voice" | "training_pairs", "label": "First-person thought", "query": "sharpened search string (web_search only)" }

Rules for label voice — make them sound like a person reasoning, not a system executing:
- First-person, conversational, curious. Start with verbs like "Let me", "Want to", "Curious about", "Worth checking", "I want to understand".
- GOOD examples:
    "Let me see what's been landing with fintech CFOs this quarter — they're under real cost pressure right now"
    "Want to double-check your brand voice — your guidelines lean direct, no fluff"
    "Curious if we've written something similar that already worked — checking the corpus"
    "I want to understand what their inbox actually looks like before I write into it"
- BAD examples (do NOT use):
    "Pulling 3 recent Forrester reports on ABM tier-1 motions"  ← robotic, lists task
    "Cross-referencing your brand voice for cold-email tone"      ← machine-speak
    "Checking the Reverb training corpus for proven openers"       ← system-speak

Step composition:
- 2-4 steps total. Always include exactly one brand_voice step ("Want to double-check your brand voice..." or similar) and exactly one training_pairs step ("Curious if we've written something similar..." or similar). The remaining 0-2 slots are web_search steps.
- Sequence reflects how a human would reason: usually web research first (you'd want fresh context before recalling internal knowledge), then brand voice, then prior wins. But not rigid — order by what would feel natural for THIS specific prompt.
- web_search "query" stays sharp and tactical (add year 2026, specific personas, frameworks, vendors) even when the label is conversational. The label is what the user reads; the query is what hits Exa.
- If the user's prompt is a simple conversational reply ("shorter", "in US English", "thanks", a one-word ask): return zero web_search steps — still include the brand_voice and training_pairs steps with light labels like "Quick check on your brand voice" and "Looking for a similar past tweak in the corpus".

Return ONLY the JSON. No preamble, no markdown fences, no commentary.`;

export async function planResearch(
  userQuery: string,
  conversationContext: string,
  apiKey: string
): Promise<ResearchPlan> {
  // Conservative fallback used when the planner errors, returns
  // malformed JSON, or the API key is missing. Keeps the chat flow
  // working — the user still sees a thinking trace, just a generic one.
  const fallback: ResearchPlan = {
    intent: "Let me think this through carefully before answering.",
    steps: [
      { kind: "brand_voice", label: "Quick check on your brand voice" },
      { kind: "training_pairs", label: "Looking for a similar past answer I can lean on" },
    ],
  };

  if (!apiKey || !userQuery.trim()) return fallback;

  const groq = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  try {
    const res = await groq.chat.completions.create({
      model: PLANNER_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: conversationContext
            ? `Recent conversation:\n${conversationContext}\n\nCurrent user prompt:\n${userQuery}`
            : userQuery,
        },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as ResearchPlan;
    if (!parsed.intent || !Array.isArray(parsed.steps)) return fallback;

    // Normalise: ensure brand_voice + training_pairs are present at the
    // end even if the model forgot. Cap web_search count at 2 to keep
    // the latency budget reasonable.
    const webSteps = parsed.steps
      .filter((s) => s.kind === "web_search" && s.query)
      .slice(0, 2);
    const hasBrandVoice = parsed.steps.some((s) => s.kind === "brand_voice");
    const hasPairs = parsed.steps.some((s) => s.kind === "training_pairs");

    const finalSteps: ResearchStep[] = [
      ...webSteps,
      ...(hasBrandVoice
        ? parsed.steps.filter((s) => s.kind === "brand_voice").slice(0, 1)
        : [{ kind: "brand_voice" as const, label: "Quick check on your brand voice" }]),
      ...(hasPairs
        ? parsed.steps.filter((s) => s.kind === "training_pairs").slice(0, 1)
        : [{ kind: "training_pairs" as const, label: "Looking for a similar past answer I can lean on" }]),
    ];

    return {
      intent: parsed.intent.slice(0, 240),
      steps: finalSteps,
    };
  } catch (e) {
    console.warn("research planner failed:", e instanceof Error ? e.message : String(e));
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────
// Stream protocol. The chat route writes one JSON object per line
// between sentinel markers so the client can parse research events
// incrementally without breaking the existing plain-text answer stream.
//
// Wire format on stdout, in order:
//   <!--research:intent:Distilled intent string-->
//   <!--research:step:{"kind":"...","label":"...","status":"started"}-->
//   <!--research:step:{"kind":"...","label":"...","status":"done","result":"..."}-->
//   ...
//   <!--research:done-->
//   <answer body streams here as plain markdown text>
//   <!-- interaction_id:abc -->
//
// stream-chat.ts client parses out research markers, accumulates them
// into Message.researchTrace, and only renders bytes AFTER research:done
// as the final answer content.
// ─────────────────────────────────────────────────────────────────

export function encodeIntentMarker(intent: string): string {
  // Strip any -- to avoid breaking the comment marker, and clip length.
  const safe = intent.replace(/-->/g, "—>").slice(0, 400);
  return `<!--research:intent:${safe}-->\n`;
}

export function encodeStepMarker(
  step: ResearchStep,
  status: "started" | "done"
): string {
  const payload = JSON.stringify({
    kind: step.kind,
    label: step.label,
    status,
    ...(status === "done" && step.result ? { result: step.result } : {}),
  });
  // Same dash-escape as above so the JSON payload can never contain --> .
  const safe = payload.replace(/-->/g, "—>");
  return `<!--research:step:${safe}-->\n`;
}

export const RESEARCH_DONE_MARKER = "<!--research:done-->\n";
