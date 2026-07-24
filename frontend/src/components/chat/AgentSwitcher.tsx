"use client";

// ─────────────────────────────────────────────────────────────────
// Agent switcher — surfaces in the chat header. Shows the active
// conversation's bound Brand Agent (or the user's default if the
// conversation has no explicit binding yet) as a colored chip; opens
// a dropdown listing every agent the user owns, a "+ New brand" inline
// create form, and a link out to the full management page.
//
// State sources:
//  • useAgentStore — server-authoritative agent list + selected pointer
//  • useChatStore.activeConversation — current conversation's agentId
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Settings2, Check, BookOpen } from "lucide-react";
import { useAgentStore, type BrandAgent } from "@/lib/agent-store";
import { useChatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";

export default function AgentSwitcher() {
  const agents = useAgentStore((s) => s.agents);
  const isLoading = useAgentStore((s) => s.isLoading);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const setSelected = useAgentStore((s) => s.setSelected);
  const upsertAgent = useAgentStore((s) => s.upsert);
  const refresh = useAgentStore((s) => s.refresh);

  const conv = useChatStore((s) => s.activeConversation());
  const setConversationAgent = useChatStore((s) => s.setConversationAgent);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Initial agent fetch on mount + whenever the user signs in/out.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Outside-click closes the dropdown.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // What to show in the trigger: the conversation's bound agent if any,
  // else the user-level selected agent, else the default-flagged.
  const effectiveAgentId =
    conv?.agentId ?? selectedAgentId ?? agents.find((a) => a.is_default)?.id ?? null;
  const effective = agents.find((a) => a.id === effectiveAgentId);

  const pickAgent = (a: BrandAgent) => {
    setSelected(a.id);
    if (conv) setConversationAgent(conv.id, a.id);
    setOpen(false);
  };

  const createAgent = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/brand/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const json = await res.json();
        const agent: BrandAgent = { ...json.agent, doc_count: 0 };
        upsertAgent(agent);
        setSelected(agent.id);
        if (conv) setConversationAgent(conv.id, agent.id);
        setNewName("");
        setCreating(false);
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  // Hidden until at least one agent exists. New users will see this
  // appear automatically after their first brand upload.
  if (agents.length === 0 && !isLoading) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] sm:text-[12.5px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] transition-all"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: effective?.color ?? "#c14a2a" }}
        />
        <span className="truncate max-w-[100px] sm:max-w-[160px]">
          {effective?.name ?? (isLoading ? "Loading…" : "Brand")}
        </span>
        <ChevronDown size={11} strokeWidth={2.5} />
      </button>

      {open && (
        <div
          className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1.5 w-[260px] max-w-[calc(100vw-1.5rem)] rounded-xl overflow-hidden z-30 reverb-scale-in"
          style={{
            background: "var(--reverb-gradient-card)",
            border: "1px solid var(--reverb-border-soft)",
            boxShadow: "var(--reverb-shadow-xl)",
          }}
        >
          <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)]">
              Brand Agent
            </p>
            <Link
              href="/agents"
              className="flex items-center gap-1 text-[10.5px] font-semibold text-[var(--reverb-accent)] hover:underline"
              onClick={() => setOpen(false)}
            >
              <Settings2 size={10} /> Manage
            </Link>
          </div>

          <div className="max-h-[260px] overflow-y-auto reverb-scroll">
            {agents.map((a) => {
              const active = effectiveAgentId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => pickAgent(a)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors",
                    active ? "bg-[#fbf3ee]" : "hover:bg-[#faf6ef]"
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: a.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-[var(--reverb-text-primary)] truncate">
                      {a.name}
                      {a.is_default && (
                        <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--reverb-accent)]">
                          default
                        </span>
                      )}
                    </p>
                    <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] flex items-center gap-1">
                      <BookOpen size={9} /> {a.doc_count} doc{a.doc_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  {active && <Check size={12} className="text-[var(--reverb-accent)] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--reverb-border-soft)]">
            {creating ? (
              <div className="px-3.5 py-2.5 flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.slice(0, 60))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createAgent();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  placeholder="e.g. Acme Co"
                  className="flex-1 text-[12.5px] font-medium bg-white border border-[var(--reverb-accent)] rounded-md px-2 py-1 focus:outline-none"
                />
                <button
                  onClick={() => void createAgent()}
                  disabled={busy || !newName.trim()}
                  className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold reverb-btn-primary disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--reverb-accent)] hover:bg-[#faf6ef] transition-colors"
              >
                <Plus size={12} strokeWidth={2.5} /> New brand
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
