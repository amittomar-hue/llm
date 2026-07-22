// ─────────────────────────────────────────────────────────────────
// /api/v1/chat — PUBLIC third-party endpoint.
//
// Auth: Authorization: Bearer dmoop_live_<40-char>
// Body: { prompt: string, agent_id?: string, model?: string,
//         messages?: OpenAI-style messages, web_search?: boolean }
// Response: { response: string, model_used: string,
//             agent_used: string | null }
//
// Deliberately BLOCKING (non-streaming) for MVP — third-party
// integrations don't want SSE parsing complexity for their first
// integration. We can add ?stream=true in a later version.
//
// Grounding: if agent_id is provided AND the API key's owner owns
// that agent, we inject brand voice profile + top brand chunks
// exactly like the internal /api/chat flow (but without the heavy
// FORMAT CONTRACT persona — third parties want raw content, not
// DMOOP's opinionated formatting).
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { verifyApiKey, extractBearerToken } from "@/lib/api-keys";
import { getSupabase } from "@/lib/supabase";
import { retrieveBrandChunks, formatBrandContext } from "@/lib/brand";
import { formatVoiceProfileForContext, type VoiceProfile } from "@/lib/voice-profile";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const ALLOWED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

// Preflight — required for browser-based third-party JS clients.
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const token = extractBearerToken(req.headers.get("authorization"));
  const auth = await verifyApiKey(token);
  if (!auth) {
    return json(
      { error: "Invalid or missing API key. Include: Authorization: Bearer dmoop_live_..." },
      401
    );
  }

  // 2. Body validation
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "Body must be JSON" }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const messagesIn = Array.isArray(body.messages) ? body.messages : null;
  if (!prompt && !messagesIn) {
    return json({ error: "Provide either `prompt` (string) or `messages` (array)" }, 400);
  }

  const agentId = typeof body.agent_id === "string" ? body.agent_id : null;
  const requestedModel = typeof body.model === "string" ? body.model : DEFAULT_MODEL;
  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;

  // 3. Build the message array
  const userMessages: ChatMessage[] = messagesIn
    ? (messagesIn as unknown[]).filter((m): m is ChatMessage => {
        if (!m || typeof m !== "object") return false;
        const cast = m as { role?: unknown; content?: unknown };
        return (
          (cast.role === "user" || cast.role === "assistant" || cast.role === "system") &&
          typeof cast.content === "string"
        );
      })
    : [{ role: "user", content: prompt }];

  if (userMessages.length === 0) {
    return json({ error: "`messages` must contain at least one message" }, 400);
  }

  // 4. Resolve brand context (voice profile + chunks) if agent_id given
  //    and the caller owns that agent
  const service = getSupabase();
  if (!service) return json({ error: "Service unavailable" }, 503);

  let brandContext = "";
  let voiceContext = "";
  let agentName: string | null = null;

  if (agentId) {
    const { data: agentRow } = await service
      .from("brand_agents")
      .select("id, name, voice_profile")
      .eq("id", agentId)
      .eq("user_id", auth.userId)   // ownership check
      .maybeSingle();

    if (agentRow) {
      agentName = agentRow.name as string;
      const profile = (agentRow.voice_profile as VoiceProfile | null) ?? null;
      voiceContext = formatVoiceProfileForContext(profile);

      // Retrieve top-4 brand chunks against the last user message.
      const lastUserMsg = [...userMessages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        try {
          const chunks = await retrieveBrandChunks(
            auth.userId,
            lastUserMsg.content,
            4,
            agentId
          );
          brandContext = formatBrandContext(chunks);
        } catch (err) {
          console.error("[v1/chat] retrieveBrandChunks failed:", err);
        }
      }
    } else {
      return json(
        { error: `agent_id "${agentId}" not found or not owned by your account.` },
        403
      );
    }
  }

  // 5. Build the message stack for Groq
  const persona = agentName
    ? `You are a marketing content generator writing for the brand "${agentName}". Ground every response in the brand voice profile and brand documents provided below when they are relevant. Produce the requested output directly — no preamble, no meta commentary, no clarifying questions.`
    : `You are a marketing content generator. Produce the requested output directly — no preamble, no meta commentary, no clarifying questions.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: persona },
  ];
  if (voiceContext) messages.push({ role: "system", content: voiceContext });
  if (brandContext) messages.push({ role: "system", content: brandContext });
  for (const m of userMessages) {
    messages.push({ role: m.role, content: m.content });
  }

  // 6. Call Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return json({ error: "Model backend not configured" }, 503);

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 4096,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    return json({
      response: text,
      model_used: model,
      agent_used: agentName,
      usage: completion.usage
        ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          }
        : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Model call failed";
    // Don't leak Groq's raw error verbatim in case it contains internal
    // identifiers. Surface the class of failure.
    const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("rate limit");
    const isTooLarge = msg.includes("413") || msg.toLowerCase().includes("too large");
    if (isRateLimit) return json({ error: "Rate limit exceeded, please retry" }, 429);
    if (isTooLarge) return json({ error: "Request payload too large" }, 413);
    console.error("[v1/chat] model call failed:", msg);
    return json({ error: "Model call failed" }, 500);
  }
}
