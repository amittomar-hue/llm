// ─────────────────────────────────────────────────────────────────
// /api/v1 — root discovery endpoint for the public API.
//
// Returning a real JSON body from the base URL is the difference
// between a developer thinking "the API is broken" and thinking
// "I'm one docs-click from working." Every well-behaved public
// API surfaces its endpoint list here (Stripe, Anthropic, GitHub).
//
// No auth — this is discovery metadata, not user data.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    {
      name: "Reverb Public API",
      version: "v1",
      status: "operational",
      description:
        "Bearer-authenticated REST API for generating brand-grounded marketing content. " +
        "Authenticate with keys from /settings/api-keys.",
      documentation: "https://llm-amits-projects-d3468251.vercel.app/docs/api",
      key_management: "https://llm-amits-projects-d3468251.vercel.app/settings/api-keys",
      auth: {
        scheme: "Bearer",
        header_format: "Authorization: Bearer reverb_live_<40-char-secret>",
        key_prefix: "reverb_live_",
      },
      endpoints: [
        {
          path: "/api/v1/chat",
          method: "POST",
          description:
            "Generate a completion, optionally grounded in a Brand Agent's voice profile + top brand documents.",
          content_type: "application/json",
          body_fields: {
            prompt: "string — required if `messages` is absent",
            messages: "array<{role, content}> — required if `prompt` is absent",
            agent_id: "string (UUID) — optional Brand Agent to ground on",
            model: "string — optional; default 'llama-3.3-70b-versatile'",
          },
          response_fields: {
            response: "string — generated text",
            model_used: "string",
            agent_used: "string | null",
            usage: "{ prompt_tokens, completion_tokens, total_tokens } | null",
          },
        },
      ],
      example_curl:
        "curl https://llm-amits-projects-d3468251.vercel.app/api/v1/chat \\\n" +
        '  -H "Authorization: Bearer reverb_live_YOUR_KEY" \\\n' +
        '  -H "Content-Type: application/json" \\\n' +
        "  -d '{\"prompt\":\"Write 3 LinkedIn ad headlines.\",\"agent_id\":\"YOUR_AGENT_UUID\"}'",
    },
    { headers: CORS_HEADERS }
  );
}
