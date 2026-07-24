"use client";

// ─────────────────────────────────────────────────────────────────
// /agents — Brand Agent management. Marketing agencies running
// multiple clients use this page to create, rename, recolor, set
// default, and delete Brand Agents. Each agent corresponds to one
// silo of brand documents that the chat retrieves from when bound.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Plus, Pencil, Trash2, Star, BookOpen, Check, X as XIcon, Sparkles, ChevronDown, RefreshCw } from "lucide-react";
import { useAgentStore } from "@/lib/agent-store";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = [
  "#c14a2a", "#d97706", "#65a30d", "#0d9488",
  "#0284c7", "#7c3aed", "#db2777", "#475569",
];

export default function AgentsPage() {
  const { agents, isLoading, refresh, upsert, remove } = useAgentStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshingProfile, setRefreshingProfile] = useState<string | null>(null);

  const refreshProfile = async (id: string) => {
    setRefreshingProfile(id);
    try {
      const res = await fetch(`/api/brand/agents/${id}/refresh-profile`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        const existing = agents.find((a) => a.id === id);
        if (existing) {
          upsert({
            ...existing,
            voice_profile: json.profile,
            voice_profile_updated_at: new Date().toISOString(),
          });
        }
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Could not refresh profile");
      }
    } finally {
      setRefreshingProfile(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAgent = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy("__create");
    try {
      const res = await fetch("/api/brand/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, color: newColor }),
      });
      if (res.ok) {
        const json = await res.json();
        upsert({ ...json.agent, doc_count: 0 });
        setNewName("");
        setNewColor(COLOR_SWATCHES[0]);
        setCreating(false);
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Could not create agent");
      }
    } finally {
      setBusy(null);
    }
  };

  const patchAgent = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/brand/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        const existing = agents.find((a) => a.id === id);
        upsert({ ...json.agent, doc_count: existing?.doc_count ?? 0 });
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Update failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const deleteAgent = async (id: string) => {
    if (!confirm("Delete this agent and all its brand documents? This can't be undone.")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/brand/agents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        remove(id);
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Delete failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const commitRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    await patchAgent(id, { name });
    setEditingId(null);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--reverb-bg-app)" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-[var(--reverb-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/chat" className="flex items-center gap-2 text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
            <ArrowLeft size={13} /> Back to chat
          </Link>
          <Image src="/reverb-logo.png" alt="Reverb" width={110} height={30} className="h-6 sm:h-7 w-auto" />
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/settings/api-keys" className="hidden sm:inline text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
              API keys →
            </Link>
            <Link href="/brand" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
              Brand Library →
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <div className="mb-6 sm:mb-8">
          <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--reverb-accent)] uppercase mb-2">
            Brand Agents
          </p>
          <h1 className="text-[24px] sm:text-[32px] font-semibold tracking-tight text-[var(--reverb-text-primary)] mb-2">
            One Reverb, many brands.
          </h1>
          <p className="text-[13px] sm:text-[14px] text-[var(--reverb-text-secondary)] max-w-2xl">
            Create one Brand Agent per client. Upload their brand docs to that agent&apos;s library, and Reverb will only retrieve from that silo when you&apos;re working in that thread.
          </p>
        </div>

        {/* List + create */}
        <div className="rounded-2xl overflow-hidden mb-4"
          style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--reverb-border-soft)] flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-[var(--reverb-text-primary)]">
              {isLoading ? "Loading…" : `${agents.length} brand${agents.length === 1 ? "" : "s"}`}
            </p>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="h-8 px-3 rounded-lg text-[12px] font-semibold reverb-btn-primary flex items-center gap-1.5"
              >
                <Plus size={12} strokeWidth={2.5} /> New brand
              </button>
            )}
          </div>

          {creating && (
            <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--reverb-border-soft)] bg-[#faf6ef]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-2">
                Create a brand
              </p>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 60))}
                placeholder="e.g. Acme Corp, Beta Inc, Gamma Co"
                className="w-full text-[13.5px] font-medium bg-white border border-[var(--reverb-border-soft)] focus:border-[var(--reverb-accent)] rounded-lg px-3 py-2 mb-2.5 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform shrink-0",
                      newColor === c ? "ring-2 ring-offset-2 ring-[var(--reverb-accent)] scale-110" : "hover:scale-110 active:scale-95"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void createAgent()}
                  disabled={!newName.trim() || busy === "__create"}
                  className="h-9 px-4 rounded-lg reverb-btn-primary text-[12.5px] font-semibold disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                  className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {agents.length === 0 && !isLoading && !creating && (
            <div className="px-4 sm:px-5 py-10 text-center text-[13px] text-[var(--reverb-text-tertiary)]">
              No agents yet. Click <strong>New brand</strong> to create your first.
            </div>
          )}

          {agents.map((a) => {
            const isEditing = editingId === a.id;
            const isBusy = busy === a.id;
            const isExpanded = expandedId === a.id;
            const isRefreshing = refreshingProfile === a.id;
            const hasProfile = !!a.voice_profile;
            return (
              <div key={a.id} className="border-b border-[var(--reverb-border-soft)] last:border-0">
              <div
                className="px-3 sm:px-5 py-3 sm:py-3.5 flex items-center gap-2.5 sm:gap-3 hover:bg-[#faf6ef]/40"
              >
                {/* Color dot */}
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${a.color}20`, boxShadow: `inset 0 0 0 1px ${a.color}40` }}>
                  <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full" style={{ background: a.color }} />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value.slice(0, 60))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitRename(a.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => void commitRename(a.id)}
                      className="w-full text-[14px] font-semibold bg-white border border-[var(--reverb-accent)] rounded-md px-2 py-0.5 focus:outline-none"
                    />
                  ) : (
                    // Name + badges: badges flow inline on desktop, wrap to
                    // a second line on phones when the name eats the row.
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[13.5px] sm:text-[14px] font-semibold text-[var(--reverb-text-primary)] truncate max-w-full">
                        {a.name}
                      </p>
                      {a.is_default && (
                        <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#fbf3ee] text-[var(--reverb-accent-rich)] whitespace-nowrap">
                          default
                        </span>
                      )}
                      {hasProfile && (
                        <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 inline-flex items-center gap-0.5 whitespace-nowrap">
                          <Sparkles size={9} /> voice trained
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-[var(--reverb-text-tertiary)] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen size={10} /> {a.doc_count} brand doc{a.doc_count === 1 ? "" : "s"}
                    </span>
                    {hasProfile && a.voice_profile_updated_at && (
                      <>
                        <span className="hidden sm:inline">·</span>
                        <span className="whitespace-nowrap">voice extracted {new Date(a.voice_profile_updated_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Inline color picker — desktop only (≥md). On mobile the
                    palette lives inside the expand panel so the row doesn't
                    overflow on a 360-wide phone. */}
                <div className="hidden md:flex items-center gap-0.5 mr-1">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => void patchAgent(a.id, { color: c })}
                      disabled={isBusy}
                      title="Change color"
                      className={cn(
                        "w-4 h-4 rounded-full transition-transform",
                        a.color === c ? "ring-2 ring-offset-1 ring-[var(--reverb-text-tertiary)] scale-110" : "hover:scale-125"
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  {!a.is_default && (
                    <button
                      onClick={() => void patchAgent(a.id, { is_default: true })}
                      disabled={isBusy}
                      title="Set as default"
                      className="p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] disabled:opacity-50"
                    >
                      <Star size={13} />
                    </button>
                  )}
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => void commitRename(a.id)}
                        className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white"
                      >
                        <XIcon size={13} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(a.id);
                        setEditingName(a.name);
                      }}
                      disabled={isBusy}
                      title="Rename"
                      className="p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] disabled:opacity-50"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => void deleteAgent(a.id)}
                    disabled={isBusy || a.is_default || agents.length === 1}
                    title={a.is_default ? "Set another agent as default before deleting" : "Delete"}
                    className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 disabled:text-[var(--reverb-text-tertiary)] disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    title={isExpanded ? "Collapse" : "Show brand voice profile"}
                    className="p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] transition-transform"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              </div>

              {/* Brand Voice Profile expanded panel */}
              {isExpanded && (
                <div className="px-4 sm:px-5 pb-4 pt-1 bg-[#faf6ef]/30 space-y-3">
                  {/* Mobile-only color picker — duplicates the inline
                      desktop palette since we hide that below md. */}
                  <div className="md:hidden rounded-xl bg-white border border-[var(--reverb-border-soft)] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-2">Brand color</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c}
                          onClick={() => void patchAgent(a.id, { color: c })}
                          disabled={isBusy}
                          title="Change color"
                          className={cn(
                            "w-6 h-6 rounded-full transition-transform",
                            a.color === c ? "ring-2 ring-offset-2 ring-[var(--reverb-text-tertiary)] scale-110" : "active:scale-95"
                          )}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-[var(--reverb-border-soft)] p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                          <Sparkles size={12} className="text-violet-600" strokeWidth={2.4} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-[var(--reverb-text-primary)]">
                            Brand Voice Profile
                          </p>
                          <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] mt-0.5">
                            Auto-extracted by Reverb from this agent&apos;s brand library — injected into every chat turn alongside per-query brand chunks.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => void refreshProfile(a.id)}
                        disabled={isRefreshing || a.doc_count === 0}
                        title={a.doc_count === 0 ? "Upload a brand doc first" : "Re-run extractor"}
                        className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5 shrink-0 bg-white border border-[var(--reverb-border-soft)] hover:bg-[#fbf3ee] disabled:opacity-50 disabled:hover:bg-white"
                      >
                        <RefreshCw size={11} className={cn(isRefreshing && "animate-spin")} />
                        {isRefreshing ? "Extracting…" : "Re-extract"}
                      </button>
                    </div>

                    {!hasProfile && (
                      <div className="text-center py-6">
                        <p className="text-[12px] text-[var(--reverb-text-tertiary)]">
                          {a.doc_count === 0
                            ? "No brand docs uploaded yet — the profile builds itself the moment you upload your first doc."
                            : "Profile not yet extracted. Click Re-extract above to build it from your existing docs."}
                        </p>
                      </div>
                    )}

                    {hasProfile && a.voice_profile && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ProfileField label="Tone">
                          <div className="flex flex-wrap gap-1">
                            {a.voice_profile.tone_descriptors.map((t) => (
                              <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-violet-50 text-violet-700">
                                {t}
                              </span>
                            ))}
                          </div>
                        </ProfileField>
                        <ProfileField label="Audience">
                          <p className="text-[12px] text-[var(--reverb-text-primary)] leading-snug">
                            {a.voice_profile.audience}
                          </p>
                        </ProfileField>
                        <ProfileField label="What the brand stands for">
                          <ul className="space-y-0.5">
                            {a.voice_profile.value_props.map((v) => (
                              <li key={v} className="text-[11.5px] text-[var(--reverb-text-primary)] leading-snug flex items-start gap-1.5">
                                <span className="text-[var(--reverb-accent)] mt-0.5">▸</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </ProfileField>
                        <ProfileField label="Writing style">
                          <p className="text-[11.5px] text-[var(--reverb-text-primary)] leading-snug">
                            {a.voice_profile.writing_style}
                          </p>
                        </ProfileField>
                        <ProfileField label="Preferred vocabulary">
                          <div className="flex flex-wrap gap-1">
                            {a.voice_profile.preferred_terms.map((t) => (
                              <span key={t} className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                                {t}
                              </span>
                            ))}
                          </div>
                        </ProfileField>
                        <ProfileField label="Avoid">
                          <div className="flex flex-wrap gap-1">
                            {a.voice_profile.avoid_terms.map((t) => (
                              <span key={t} className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 line-through">
                                {t}
                              </span>
                            ))}
                          </div>
                        </ProfileField>
                        <div className="sm:col-span-2 text-[10.5px] text-[var(--reverb-text-tertiary)] flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-2 border-t border-[var(--reverb-border-soft)]">
                          <span>extracted from {a.voice_profile.doc_count} doc{a.voice_profile.doc_count === 1 ? "" : "s"}</span>
                          <span>·</span>
                          <span>{(a.voice_profile.extracted_from_chars / 1000).toFixed(1)}K chars analysed</span>
                          {a.voice_profile_updated_at && (
                            <>
                              <span>·</span>
                              <span>{new Date(a.voice_profile_updated_at).toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>

        <p className="text-[11.5px] text-[var(--reverb-text-tertiary)]">
          Delete cascades the agent&apos;s brand documents. Conversations bound to a deleted agent fall back to your default.
          The Brand Voice Profile re-extracts automatically on every upload — or use Re-extract above to refresh on demand.
        </p>
      </main>
    </div>
  );
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1">{label}</p>
      {children}
    </div>
  );
}
