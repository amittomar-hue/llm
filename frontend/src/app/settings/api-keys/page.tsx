"use client";

// ─────────────────────────────────────────────────────────────────
// /settings/api-keys — user-facing management for third-party
// integration keys. On create, the plaintext is shown once behind
// a copy-to-clipboard + explicit "I've saved it" dismiss. After
// that, only the prefix (`reverb_live_abc123…`) is visible.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Key, Plus, Trash2, Copy, Check, AlertTriangle, Loader2, ExternalLink, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ plaintext: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/api-keys");
      const j = await res.json();
      if (res.ok) setKeys(j.keys ?? []);
      else setError(j.error ?? "Failed to load keys");
    } catch {
      setError("Network error while loading keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const createKey = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Create failed");
      // Show the plaintext ONCE
      setRevealedKey({ plaintext: j.plaintext, name: j.key.name });
      setNewName("");
      setCreating(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm("Revoke this key? Any third-party apps using it will stop working immediately.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Revoke failed");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey.plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy — select the key manually and copy with Ctrl+C.");
    }
  };

  const fmt = (iso: string | null) => {
    if (!iso) return "never";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--reverb-bg-app)" }}>
      <nav className="sticky top-0 z-30 border-b border-[var(--reverb-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/chat" className="flex items-center gap-2 text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
            <ArrowLeft size={13} /> Back to chat
          </Link>
          <Image src="/reverb-logo.png" alt="Reverb" width={110} height={30} className="h-6 sm:h-7 w-auto" />
          <div className="flex items-center gap-4">
            <Link href="/settings/integrations" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
              Integrations
            </Link>
            <Link href="/docs/api" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] flex items-center gap-1">
              API docs <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-start gap-3 mb-6 sm:mb-8">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
            <Key size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--reverb-accent)] uppercase mb-1">
              Developer
            </p>
            <h1 className="text-[24px] sm:text-[30px] font-semibold tracking-tight text-[var(--reverb-text-primary)] leading-tight mb-1">
              API Keys
            </h1>
            <p className="text-[13px] sm:text-[14px] text-[var(--reverb-text-secondary)]">
              Mint keys to call the Reverb API from your third-party app. Each key inherits your brand agents and library.
              See <Link href="/docs/api" className="text-[var(--reverb-accent)] font-medium underline underline-offset-2">API docs</Link> for the endpoint reference.
            </p>
          </div>
        </div>

        {revealedKey && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 mb-5">
            <div className="flex items-start gap-2.5 mb-3">
              <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-amber-900">
                  Save your key now — this is the only time you can see it.
                </p>
                <p className="text-[12px] text-amber-800 mt-0.5">
                  Key <strong>&quot;{revealedKey.name}&quot;</strong> — copy it into your app&apos;s secrets manager. If you lose it, revoke and regenerate.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg p-2.5">
              <code className="flex-1 text-[12.5px] font-mono text-[var(--reverb-text-primary)] break-all">
                {revealedKey.plaintext}
              </code>
              <button
                onClick={copyKey}
                className="h-8 px-3 rounded-md text-[12px] font-semibold flex items-center gap-1.5 shrink-0 bg-amber-600 text-white hover:bg-amber-700"
              >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <button
              onClick={() => setRevealedKey(null)}
              className="mt-3 text-[12px] font-medium text-amber-900 hover:text-amber-950 underline underline-offset-2"
            >
              I&apos;ve saved it — dismiss this
            </button>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden mb-4"
          style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--reverb-border-soft)] flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-[var(--reverb-text-primary)]">
              {loading ? "Loading…" : `${keys?.length ?? 0} active key${keys?.length === 1 ? "" : "s"}`}
            </p>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="h-8 px-3 rounded-lg text-[12px] font-semibold reverb-btn-primary flex items-center gap-1.5"
              >
                <Plus size={12} strokeWidth={2.5} /> New API key
              </button>
            )}
          </div>

          {creating && (
            <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--reverb-border-soft)] bg-[#faf6ef]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-2">
                Name this key
              </p>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 80))}
                onKeyDown={(e) => { if (e.key === "Enter") void createKey(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
                placeholder='e.g. "Production Zapier", "n8n integration", "Local dev"'
                className="w-full text-[13.5px] font-medium bg-white border border-[var(--reverb-border-soft)] focus:border-[var(--reverb-accent)] rounded-lg px-3 py-2 mb-3 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void createKey()}
                  disabled={!newName.trim() || busy}
                  className="h-9 px-4 rounded-lg reverb-btn-primary text-[12.5px] font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {busy ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : "Create key"}
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(""); }}
                  className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="px-4 sm:px-5 py-2.5 bg-red-50 border-b border-red-200 text-[12.5px] text-red-700 flex items-start gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {!loading && keys?.length === 0 && (
            <div className="px-4 sm:px-5 py-10 text-center">
              <Key size={24} className="mx-auto text-[var(--reverb-text-tertiary)] mb-2 opacity-40" />
              <p className="text-[13px] text-[var(--reverb-text-secondary)] font-medium">No API keys yet</p>
              <p className="text-[12px] text-[var(--reverb-text-tertiary)] mt-1">
                Click <strong>New API key</strong> above to mint your first one.
              </p>
            </div>
          )}

          {(keys ?? []).map((k) => (
            <div key={k.id} className="px-4 sm:px-5 py-3.5 border-b border-[var(--reverb-border-soft)] last:border-0 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#fbf3ee] flex items-center justify-center shrink-0">
                <Key size={14} className="text-[var(--reverb-accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)] truncate">{k.name}</p>
                <p className="text-[11px] text-[var(--reverb-text-tertiary)] font-mono mt-0.5">
                  {k.key_prefix}…{"  ·  "}
                  <span className="font-sans">
                    Last used: {fmt(k.last_used_at)}  ·  Created: {fmt(k.created_at)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => void revokeKey(k.id)}
                disabled={busy}
                className="p-2 rounded-lg text-[var(--reverb-text-secondary)] hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                title="Revoke this key"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4 sm:p-5 bg-[#fbf8f4] border border-[var(--reverb-border-soft)]">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-[12.5px] text-[var(--reverb-text-secondary)] leading-relaxed">
              <strong className="text-[var(--reverb-text-primary)]">Key hygiene:</strong>{" "}
              treat these like passwords. Store them in a secrets manager, never in client-side JS or a public repo.
              Revoke and regenerate the moment a key is exposed. Each key can be identified by its prefix in the table above.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
