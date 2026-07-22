import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Key } from "lucide-react";

export const metadata: Metadata = {
  title: "API Reference — DMOOP",
  description:
    "Integrate DMOOP into your third-party app. Bearer-token authenticated REST API for generating brand-grounded marketing content.",
  alternates: { canonical: "/docs/api" },
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--dmoop-bg-app)" }}>
      <nav className="sticky top-0 z-30 border-b border-[var(--dmoop-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={130} height={36} priority className="h-7 sm:h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] flex items-center gap-1">
              <ArrowLeft size={13} /> Home
            </Link>
            <Link href="/settings/api-keys" className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg dmoop-btn-primary text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-1.5 shrink-0">
              <Key size={13} /> Get an API key
            </Link>
          </div>
        </div>
      </nav>

      <article className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-20 w-full">
        <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-3">
          Developer
        </p>
        <h1 className="text-[28px] sm:text-[42px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-[1.15] mb-4">
          DMOOP API Reference
        </h1>
        <p className="text-[15px] sm:text-[17px] text-[var(--dmoop-text-secondary)] leading-relaxed mb-8 pb-8 border-b border-[var(--dmoop-border-soft)]">
          A REST API for generating brand-grounded marketing content. Authenticate with a
          key from{" "}
          <Link href="/settings/api-keys" className="text-[var(--dmoop-accent)] font-medium underline underline-offset-2">
            /settings/api-keys
          </Link>
          , POST a prompt, get back generated text. Optionally attach an <code className="text-[13px] px-1 py-0.5 rounded bg-[#f5f1ea]">agent_id</code> to
          ground the output in one of your brand agents.
        </p>

        <div className="resource-prose">
          <h2>Base URL</h2>
          <pre><code>https://www.dmoop.com/api/v1</code></pre>

          <h2>Authentication</h2>
          <p>
            All requests require an <strong>Authorization</strong> header:
          </p>
          <pre><code>Authorization: Bearer dmoop_live_&lt;your-key&gt;</code></pre>
          <p>
            Generate keys at{" "}
            <Link href="/settings/api-keys" className="text-[var(--dmoop-accent)] font-medium underline underline-offset-2">
              /settings/api-keys
            </Link>
            . Each key is shown once at creation — save it in your secrets manager. If lost, revoke and regenerate.
            Keys inherit the owning user&apos;s brand agents and documents.
          </p>

          <h2>POST /api/v1/chat</h2>
          <p>Generates a completion, optionally grounded in a brand agent&apos;s voice profile + top brand documents.</p>

          <h3>Request body</h3>
          <table>
            <thead>
              <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>prompt</code></td><td>string</td><td>either this</td><td>Single-shot user prompt. Simple case.</td></tr>
              <tr><td><code>messages</code></td><td>array</td><td>or this</td><td>OpenAI-style {`{ role, content }`} list for multi-turn.</td></tr>
              <tr><td><code>agent_id</code></td><td>string (UUID)</td><td>optional</td><td>Your Brand Agent ID. Injects voice profile + top-4 brand chunks.</td></tr>
              <tr><td><code>model</code></td><td>string</td><td>optional</td><td>Default <code>llama-3.3-70b-versatile</code>. Also <code>llama-3.1-8b-instant</code>, <code>meta-llama/llama-4-scout-17b-16e-instruct</code>.</td></tr>
            </tbody>
          </table>

          <h3>Response</h3>
          <table>
            <thead>
              <tr><th>Field</th><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>response</code></td><td>string</td><td>The generated text.</td></tr>
              <tr><td><code>model_used</code></td><td>string</td><td>The underlying model actually invoked.</td></tr>
              <tr><td><code>agent_used</code></td><td>string | null</td><td>Name of the Brand Agent grounding the response, if any.</td></tr>
              <tr><td><code>usage</code></td><td>object</td><td>Token counts: <code>prompt_tokens</code>, <code>completion_tokens</code>, <code>total_tokens</code>.</td></tr>
            </tbody>
          </table>

          <h3>Status codes</h3>
          <table>
            <thead>
              <tr><th>Code</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td>200</td><td>Success.</td></tr>
              <tr><td>400</td><td>Malformed body (missing prompt/messages).</td></tr>
              <tr><td>401</td><td>Missing or invalid Bearer token.</td></tr>
              <tr><td>403</td><td>The provided <code>agent_id</code> is not owned by your account.</td></tr>
              <tr><td>413</td><td>Request too large.</td></tr>
              <tr><td>429</td><td>Rate limited.</td></tr>
              <tr><td>500 / 503</td><td>Upstream model failure or misconfigured backend.</td></tr>
            </tbody>
          </table>

          <h2>Example — cURL</h2>
          <pre><code>{`curl https://www.dmoop.com/api/v1/chat \\
  -H "Authorization: Bearer dmoop_live_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Write 3 LinkedIn ad headlines for our new AI-accelerated data platform.",
    "agent_id": "YOUR_AGENT_UUID"
  }'`}</code></pre>

          <h2>Example — Node.js (fetch)</h2>
          <pre><code>{`const res = await fetch("https://www.dmoop.com/api/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.DMOOP_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "Write 3 LinkedIn ad headlines for our new AI-accelerated data platform.",
    agent_id: process.env.DMOOP_AGENT_ID,
  }),
});
const data = await res.json();
console.log(data.response);`}</code></pre>

          <h2>Example — Python (requests)</h2>
          <pre><code>{`import os, requests

r = requests.post(
    "https://www.dmoop.com/api/v1/chat",
    headers={"Authorization": f"Bearer {os.environ['DMOOP_API_KEY']}"},
    json={
        "prompt": "Write 3 LinkedIn ad headlines for our new AI-accelerated data platform.",
        "agent_id": os.environ["DMOOP_AGENT_ID"],
    },
    timeout=60,
)
r.raise_for_status()
print(r.json()["response"])`}</code></pre>

          <h2>Example — multi-turn conversation</h2>
          <pre><code>{`curl https://www.dmoop.com/api/v1/chat \\
  -H "Authorization: Bearer dmoop_live_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "YOUR_AGENT_UUID",
    "messages": [
      { "role": "user",      "content": "Write a landing page hero for our AI Engineering practice." },
      { "role": "assistant", "content": "…first draft here…" },
      { "role": "user",      "content": "Shorten the sub-headline to under 12 words." }
    ]
  }'`}</code></pre>

          <h2>Brand grounding</h2>
          <p>
            When <code>agent_id</code> is provided (and owned by the API key&apos;s user), DMOOP injects:
          </p>
          <ul>
            <li>The agent&apos;s <strong>voice profile</strong> (tone, audience, preferred vocab, terms to avoid)</li>
            <li>The <strong>top-4 brand documents</strong> most relevant to the user prompt via similarity retrieval</li>
          </ul>
          <p>
            No brand context is injected when <code>agent_id</code> is omitted. To get the most on-brand output,
            always pass <code>agent_id</code> and keep the corresponding agent&apos;s brand library up to date at{" "}
            <Link href="/brand" className="text-[var(--dmoop-accent)] font-medium underline underline-offset-2">/brand</Link>.
          </p>

          <h2>Support</h2>
          <p>
            Bug reports and integration questions: <a href="mailto:support@dmoop.com" className="text-[var(--dmoop-accent)] font-medium underline underline-offset-2">support@dmoop.com</a>.
            Include the request timestamp and the response body — never the API key itself.
          </p>
        </div>

        <div className="mt-10 sm:mt-14 p-5 sm:p-6 rounded-2xl"
          style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)" }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--dmoop-accent)] mb-1.5">
            Ready to build?
          </p>
          <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2">
            Mint your first key.
          </h3>
          <p className="text-[13px] sm:text-[14px] text-[var(--dmoop-text-secondary)] mb-4 leading-relaxed">
            Takes 20 seconds. Copy the plaintext when it&apos;s shown, drop it into your app&apos;s env vars, and you&apos;re integrating.
          </p>
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl dmoop-btn-primary text-[13px] font-semibold"
          >
            Get an API key <ArrowRight size={14} />
          </Link>
        </div>
      </article>
    </div>
  );
}
