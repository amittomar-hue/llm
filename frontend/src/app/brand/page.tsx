"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, FileText, Trash2, Loader2, BookOpen, AlertCircle, CheckCircle2, Wand2, Check, ChevronDown, Plus } from "lucide-react";
import { DOC_TYPES, classifyDocType } from "@/lib/brand";
import { useAgentStore, type BrandAgent as BrandAgentType } from "@/lib/agent-store";
import { parseDocumentClient } from "@/lib/parse-document-client";
import { cn } from "@/lib/utils";

interface BrandDoc {
  id: string;
  filename: string;
  doc_type: string;
  total_chars: number;
  total_chunks: number;
  uploaded_at: string;
}

interface DocList {
  documents: BrandDoc[];
  total_documents: number;
  total_chars: number;
  total_chunks: number;
}

export default function BrandPage() {
  const [list, setList] = useState<DocList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  // Agent picker dropdown state (lives inside the Brand Agent card so
  // the user can see and switch their upload destination in one place).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  // "auto" = let classifyDocType pick from filename + content after parse.
  // The dropdown defaults to Auto; user can pin a specific type to force
  // every subsequent upload to use that label.
  const [docType, setDocType] = useState<string>("auto");
  // The type the classifier picked for the most recent upload — surfaced
  // as a "Auto-detected as X" chip so the user sees what happened.
  const [lastDetectedType, setLastDetectedType] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState<string>("");
  const [savedTick, setSavedTick] = useState(false);
  // Most recent PII redaction summary, surfaced as a one-shot banner on success
  const [lastPii, setLastPii] = useState<{ filename: string; total: number; by_type: Record<string, number> } | null>(null);
  // Bulk-move state — selected doc IDs the user wants to re-home to a different agent.
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  // Brand Library is scoped to the currently-selected agent. When the
  // user switches agents in the header dropdown, the doc list reloads
  // to show only that agent's silo.
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const refreshAgents = useAgentStore((s) => s.refresh);
  const upsertAgent = useAgentStore((s) => s.upsert);
  const setSelectedAgent = useAgentStore((s) => s.setSelected);
  const agents = useAgentStore((s) => s.agents);
  const selectedAgent = useAgentStore((s) =>
    s.agents.find((a) => a.id === s.selectedAgentId) ?? null
  );
  const agentName = selectedAgent?.name ?? "Brand Agent";

  // Outside-click closes the agent picker.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pickAgent = (a: BrandAgentType) => {
    setSelectedAgent(a.id);
    setPickerOpen(false);
  };

  const createAgent = async () => {
    const name = newAgentName.trim();
    if (!name) return;
    setCreatingBusy(true);
    try {
      const res = await fetch("/api/brand/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const json = await res.json();
        const agent: BrandAgentType = { ...json.agent, doc_count: 0 };
        upsertAgent(agent);
        setSelectedAgent(agent.id);
        setNewAgentName("");
        setCreatingAgent(false);
        setPickerOpen(false);
      }
    } finally {
      setCreatingBusy(false);
    }
  };

  // Keep draftName in sync with the currently-selected agent's name
  // whenever the user switches agents in the header dropdown.
  useEffect(() => { setDraftName(agentName); }, [agentName]);
  // Clear selection whenever the active agent changes — selected IDs
  // belong to a different library now.
  useEffect(() => { setSelectedDocs(new Set()); }, [selectedAgentId]);

  // PATCH the selected agent's name on the server. Replaces the old
  // localStorage-only saveAgentName so renames sync across devices.
  const saveAgentName = async () => {
    if (!selectedAgent || !draftName.trim() || draftName === agentName) return;
    const res = await fetch(`/api/brand/agents/${selectedAgent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: draftName.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      upsertAgent({ ...json.agent, doc_count: selectedAgent.doc_count });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    }
  };

  // Bulk move: re-home N selected docs to a different agent. Each PATCH
  // is independent so partial failures show partial moves rather than
  // a misleading all-or-nothing rollback. Refreshes doc counts after.
  const moveSelectedTo = async (targetAgentId: string) => {
    if (selectedDocs.size === 0) return;
    setMoving(true);
    setMoveMenuOpen(false);
    try {
      await Promise.all(
        Array.from(selectedDocs).map((id) =>
          fetch(`/api/brand/documents/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ agent_id: targetAgentId }),
          })
        )
      );
      setSelectedDocs(new Set());
      await load();
      void refreshAgents();
    } finally {
      setMoving(false);
    }
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!list) return;
    if (selectedDocs.size === list.documents.length) setSelectedDocs(new Set());
    else setSelectedDocs(new Set(list.documents.map((d) => d.id)));
  };

  const load = async () => {
    const url = selectedAgentId
      ? `/api/brand/documents?agent_id=${encodeURIComponent(selectedAgentId)}`
      : "/api/brand/documents";
    const data = await fetch(url).then((r) => r.json());
    setList(data);
  };

  useEffect(() => { void refreshAgents(); }, [refreshAgents]);
  useEffect(() => { load(); }, [selectedAgentId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);

    try {
      // Step 1: Parse client-side with PII redaction ON (default).
      // Customer PII (emails, phones, SSN, CC, API keys) is replaced with
      // [REDACTED:<type>] tokens locally — the raw values never leave the browser.
      setProgress(`Parsing ${file.name}…`);
      const parsed = await parseDocumentClient(file, { redactPii: true });
      if (!parsed.ok) throw new Error(parsed.error);

      const piiTotal = parsed.pii?.total ?? 0;
      if (piiTotal > 0) {
        setLastPii({ filename: file.name, total: piiTotal, by_type: parsed.pii!.by_type });
      } else {
        setLastPii(null);
      }

      // Resolve doc_type: if user left the picker on "auto", run the
      // classifier against the parsed text + filename; otherwise honor
      // their explicit pick. classifyDocType returns "general" when
      // signals are ambiguous, so the worst case stays safe.
      const resolvedDocType =
        docType === "auto" ? classifyDocType(file.name, parsed.text) : docType;
      if (docType === "auto") setLastDetectedType(resolvedDocType);
      else setLastDetectedType(null);

      // Step 2: Send redacted text to /api/brand/upload
      setProgress(piiTotal > 0
        ? `Indexing into brand library (${piiTotal} PII items redacted locally)…`
        : `Indexing into brand library…`);
      const uploadRes = await fetch("/api/brand/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          text: parsed.text,
          doc_type: resolvedDocType,
          pii_summary: parsed.pii ?? null,
          agent_id: selectedAgentId,
        }),
      });
      const result = await uploadRes.json();
      if (!uploadRes.ok) {
        // Surface the full server diagnostic (stage + detail) so PPTX/DOCX
        // parse/insert failures don't require a DevTools trip to debug.
        const parts = [
          result.error ?? "Upload failed",
          result.stage ? `stage=${result.stage}` : null,
          result.detail ? `detail=${result.detail}` : null,
        ].filter(Boolean);
        throw new Error(parts.join("  ·  "));
      }

      await load();
      // Doc counts on agent chips might have changed — refresh.
      void refreshAgents();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteDoc = async (id: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? Reverb will stop using it as context.`)) return;
    await fetch("/api/brand/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  };

  const empty = (list?.total_documents ?? 0) === 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--reverb-bg-app)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--reverb-border-soft)] bg-white/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/chat" className="flex items-center gap-1.5 text-[12.5px] text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] transition-colors shrink-0">
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back to chat</span>
            </Link>
            <span className="h-4 w-px bg-[var(--reverb-border-soft)] hidden sm:block" />
            <span className="font-semibold tracking-tight text-[var(--reverb-accent)] text-lg">Reverb</span>
            <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--reverb-accent)] uppercase px-1.5 sm:px-2 py-0.5 rounded-md shrink-0" style={{ background: "rgba(193,74,42,0.1)" }}>
              Brand
            </span>
            {selectedAgent && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--reverb-text-secondary)] px-2 py-1 rounded-md bg-[#faf6ef] border border-[var(--reverb-border-soft)] shrink-0">
                <span className="w-2 h-2 rounded-full" style={{ background: selectedAgent.color }} />
                Viewing <strong className="font-semibold text-[var(--reverb-text-primary)]">{selectedAgent.name}</strong>
              </span>
            )}
          </div>
          <Link
            href="/agents"
            className="text-[12.5px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] shrink-0 flex items-center gap-1"
          >
            Manage agents →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Headline */}
        <div className="mb-6 reverb-fade-in flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
            <BookOpen size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-tight text-[var(--reverb-text-primary)] leading-tight">
              Brand Library
            </h1>
            <p className="text-[13px] sm:text-[14px] text-[var(--reverb-text-secondary)] mt-1">
              Upload your brand guidelines, style guides, product info, past campaigns, or personas. Reverb will use them as authoritative context in every response — scoped to the agent picked below.
            </p>
          </div>
        </div>

        {/* Brand Agent card — picker first, rename second. The picker
            drives both the docs shown below AND which library new uploads
            land in. Switching here = switching everywhere in this session. */}
        <div className="rounded-2xl p-5 sm:p-6 mb-4"
          style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#fbf3ee] flex items-center justify-center shrink-0">
              <Wand2 size={14} className="text-[var(--reverb-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">Brand Agent</p>
              <p className="text-[12px] text-[var(--reverb-text-secondary)] mt-0.5">
                Pick which agent&apos;s library this page is showing — and where new uploads land.
              </p>
            </div>
          </div>

          {/* Picker row */}
          <div className="mb-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">
              Upload to
            </label>
            <div ref={pickerRef} className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="w-full h-11 px-3 rounded-lg bg-white border border-[var(--reverb-border-soft)] hover:border-[var(--reverb-accent)] focus:outline-none focus:border-[var(--reverb-accent)] focus:ring-4 focus:ring-[var(--reverb-accent)]/10 flex items-center gap-2.5 text-left transition-all"
              >
                {selectedAgent ? (
                  <>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: selectedAgent.color }} />
                    <span className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)] truncate">
                      {selectedAgent.name}
                    </span>
                    {selectedAgent.is_default && (
                      <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#fbf3ee] text-[var(--reverb-accent-rich)] shrink-0">
                        default
                      </span>
                    )}
                    <span className="ml-auto text-[11.5px] text-[var(--reverb-text-tertiary)] shrink-0">
                      {selectedAgent.doc_count} doc{selectedAgent.doc_count === 1 ? "" : "s"}
                    </span>
                    <ChevronDown size={14} className={cn("text-[var(--reverb-text-tertiary)] shrink-0 transition-transform", pickerOpen && "rotate-180")} />
                  </>
                ) : (
                  <>
                    <span className="text-[13px] text-[var(--reverb-text-tertiary)]">Select a brand agent…</span>
                    <ChevronDown size={14} className="text-[var(--reverb-text-tertiary)] shrink-0 ml-auto" />
                  </>
                )}
              </button>

              {pickerOpen && (
                <div
                  className="absolute left-0 right-0 top-full mt-1.5 rounded-xl overflow-hidden z-30 reverb-scale-in"
                  style={{
                    background: "var(--reverb-gradient-card)",
                    border: "1px solid var(--reverb-border-soft)",
                    boxShadow: "var(--reverb-shadow-xl)",
                  }}
                >
                  <div className="max-h-[260px] overflow-y-auto reverb-scroll">
                    {agents.map((a) => {
                      const active = selectedAgentId === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => pickAgent(a)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors",
                            active ? "bg-[#fbf3ee]" : "hover:bg-[#faf6ef]"
                          )}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[var(--reverb-text-primary)] truncate">
                              {a.name}
                              {a.is_default && (
                                <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--reverb-accent)]">
                                  default
                                </span>
                              )}
                            </p>
                          </div>
                          <span className="text-[10.5px] text-[var(--reverb-text-tertiary)] shrink-0">
                            {a.doc_count} doc{a.doc_count === 1 ? "" : "s"}
                          </span>
                          {active && <Check size={12} className="text-[var(--reverb-accent)] shrink-0" />}
                        </button>
                      );
                    })}
                    {agents.length === 0 && (
                      <p className="px-3.5 py-4 text-center text-[12px] text-[var(--reverb-text-tertiary)]">
                        No agents yet. Create your first below.
                      </p>
                    )}
                  </div>

                  <div className="border-t border-[var(--reverb-border-soft)]">
                    {creatingAgent ? (
                      <div className="px-3.5 py-2.5 flex items-center gap-2">
                        <input
                          autoFocus
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value.slice(0, 60))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void createAgent();
                            if (e.key === "Escape") { setCreatingAgent(false); setNewAgentName(""); }
                          }}
                          placeholder="e.g. Acme Co"
                          className="flex-1 text-[12.5px] font-medium bg-white border border-[var(--reverb-accent)] rounded-md px-2 py-1 focus:outline-none"
                        />
                        <button
                          onClick={() => void createAgent()}
                          disabled={creatingBusy || !newAgentName.trim()}
                          className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold reverb-btn-primary disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCreatingAgent(true)}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--reverb-accent)] hover:bg-[#faf6ef] transition-colors"
                      >
                        <Plus size={12} strokeWidth={2.5} /> New brand agent
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rename row — operates on the currently-selected agent. Kept
              below the picker so the relationship is obvious. */}
          {selectedAgent && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">
                Rename this agent
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveAgentName()}
                  placeholder='e.g. "Acme Brand Voice"'
                  maxLength={40}
                  className="flex-1 min-w-0 h-10 px-3 rounded-lg text-[13px] bg-white border border-[var(--reverb-border-soft)] focus:outline-none focus:border-[var(--reverb-accent)] focus:ring-4 focus:ring-[var(--reverb-accent)]/10"
                />
                <button
                  onClick={saveAgentName}
                  disabled={!draftName.trim() || draftName === agentName}
                  className={cn(
                    "h-10 px-4 rounded-lg text-[12.5px] font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0",
                    !draftName.trim() || draftName === agentName
                      ? "bg-[#f5f1ea] text-[var(--reverb-text-tertiary)] cursor-not-allowed"
                      : "reverb-btn-primary"
                  )}
                >
                  {savedTick ? <><Check size={13} /> Saved</> : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Upload card */}
        <div className="rounded-2xl p-5 sm:p-6 mb-6"
          style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <label className="flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">
                <span>Document type</span>
                {lastDetectedType && docType === "auto" && (
                  <span className="inline-flex items-center gap-1 text-[10px] normal-case tracking-normal font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <Check size={9} strokeWidth={3} />
                    {DOC_TYPES.find((d) => d.value === lastDetectedType)?.label ?? lastDetectedType}
                  </span>
                )}
              </label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-[13px] bg-white border border-[var(--reverb-border-soft)] focus:outline-none focus:border-[var(--reverb-accent)] focus:ring-4 focus:ring-[var(--reverb-accent)]/10">
                <option value="auto">✨ Auto-detect (recommended)</option>
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] mt-1">
                {docType === "auto"
                  ? "Reverb scans filename + content to pick the right category."
                  : docType === "template"
                  ? "Template docs are injected WHOLE into strategic-plan requests so Reverb mimics their structure, depth, and density. Best for: past GTM plans, execution playbooks, board-deck outlines, 20-30 page campaign briefs."
                  : "Pinned — every upload uses this label until you change it."}
              </p>
            </div>
            <div className="flex-1 sm:flex-[1.2]">
              <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">
                Upload file
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md,.csv,.json,.html,.htm,.xml,.yml,.yaml"
                onChange={handleFile}
                disabled={uploading}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "w-full h-10 rounded-lg flex items-center justify-center gap-2 text-[13px] font-semibold transition-all",
                  uploading
                    ? "bg-[#f5f1ea] text-[var(--reverb-text-tertiary)] cursor-wait"
                    : "reverb-btn-primary"
                )}
              >
                {uploading ? (
                  <><Loader2 size={14} className="animate-spin" /> {progress || "Processing…"}</>
                ) : (
                  <><Upload size={14} /> Choose file…</>
                )}
              </button>
            </div>
          </div>

          {err && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          {lastPii && lastPii.total > 0 && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[12.5px] text-emerald-800">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  PII scrubbed before upload: {lastPii.total} item{lastPii.total === 1 ? "" : "s"} in {lastPii.filename}
                </p>
                <p className="text-[11.5px] mt-0.5 text-emerald-700">
                  {Object.entries(lastPii.by_type)
                    .map(([k, v]) => `${v}× ${k.replace(/_/g, " ")}`)
                    .join("  ·  ")}
                  <span className="ml-2 italic">— values were replaced with [REDACTED:&lt;type&gt;] tokens locally; raw PII never reached the server.</span>
                </p>
              </div>
            </div>
          )}

          <p className="text-[11.5px] text-[var(--reverb-text-tertiary)] mt-3">
            Supports PDF, Word, Excel, PowerPoint, CSV, Markdown, and text files (up to 10MB each). PII (emails, phones, SSN, credit cards, API keys) is auto-redacted client-side before indexing.
          </p>
        </div>

        {/* Quick stats */}
        {!empty && list && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Stat label="Documents" value={list.total_documents} />
            <Stat label="Chunks indexed" value={list.total_chunks} />
            <Stat label="Total content" value={`${(list.total_chars / 1000).toFixed(1)}K chars`} />
          </div>
        )}

        {/* Document list */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <div className="px-5 py-3 border-b border-[var(--reverb-border-soft)] flex items-center justify-between gap-2">
            {selectedDocs.size > 0 ? (
              <>
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!list && selectedDocs.size === list.documents.length}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-[var(--reverb-accent)] cursor-pointer"
                  />
                  <p className="text-[13px] font-semibold text-[var(--reverb-text-primary)]">
                    {selectedDocs.size} selected
                  </p>
                  <button
                    onClick={() => setSelectedDocs(new Set())}
                    className="text-[11.5px] font-medium text-[var(--reverb-text-tertiary)] hover:text-[var(--reverb-text-primary)] transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setMoveMenuOpen((o) => !o)}
                    disabled={moving}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold reverb-btn-primary flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {moving ? "Moving…" : "Move to…"}
                  </button>
                  {moveMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-[220px] max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden z-30 reverb-scale-in"
                      style={{
                        background: "var(--reverb-gradient-card)",
                        border: "1px solid var(--reverb-border-soft)",
                        boxShadow: "var(--reverb-shadow-xl)",
                      }}
                    >
                      <p className="px-3.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)]">
                        Move {selectedDocs.size} doc{selectedDocs.size === 1 ? "" : "s"} to
                      </p>
                      {agents
                        .filter((a) => a.id !== selectedAgentId)
                        .map((a) => (
                          <button
                            key={a.id}
                            onClick={() => void moveSelectedTo(a.id)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[#faf6ef] transition-colors text-left"
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                            <span className="text-[12.5px] font-medium text-[var(--reverb-text-primary)] truncate flex-1">
                              {a.name}
                            </span>
                            <span className="text-[10.5px] text-[var(--reverb-text-tertiary)]">{a.doc_count}</span>
                          </button>
                        ))}
                      {agents.filter((a) => a.id !== selectedAgentId).length === 0 && (
                        <p className="px-3.5 py-3 text-[11.5px] text-[var(--reverb-text-tertiary)] text-center">
                          No other agents to move to. Create one in <Link href="/agents" className="text-[var(--reverb-accent)] underline">Manage agents</Link>.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  {!empty && list && (
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={toggleAll}
                      title="Select all"
                      className="h-4 w-4 accent-[var(--reverb-accent)] cursor-pointer"
                    />
                  )}
                  <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">Your brand library</p>
                </div>
                <span className="text-[10.5px] text-[var(--reverb-text-tertiary)]">
                  {list?.total_documents ?? 0} / 50 documents
                </span>
              </>
            )}
          </div>
          {empty ? (
            <div className="px-5 py-12 text-center">
              <BookOpen size={28} className="mx-auto text-[var(--reverb-text-tertiary)] mb-3 opacity-40" />
              <p className="text-[13px] text-[var(--reverb-text-secondary)] font-medium">
                No brand documents yet
              </p>
              <p className="text-[12px] text-[var(--reverb-text-tertiary)] mt-1">
                Upload your first document above. Reverb will use it on every chat to keep responses brand-aligned.
              </p>
            </div>
          ) : (
            list?.documents.map((d) => {
              const typeLabel = DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type;
              const isSelected = selectedDocs.has(d.id);
              return (
                <div key={d.id} className={cn(
                  "px-5 py-3.5 border-b border-[var(--reverb-border-soft)] last:border-0 flex items-center gap-3 transition-colors",
                  isSelected ? "bg-[#fbf3ee]" : ""
                )}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDoc(d.id)}
                    className="h-4 w-4 accent-[var(--reverb-accent)] cursor-pointer shrink-0"
                  />
                  <div className="w-9 h-9 rounded-lg bg-[#fbf3ee] flex items-center justify-center shrink-0">
                    <FileText size={15} className="text-[var(--reverb-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)] truncate">{d.filename}</p>
                    <div className="flex items-center gap-2 text-[10.5px] text-[var(--reverb-text-tertiary)] mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--reverb-text-secondary)] font-medium uppercase tracking-wide">
                        {typeLabel}
                      </span>
                      <span>{d.total_chunks} chunks</span>
                      <span>·</span>
                      <span>{(d.total_chars / 1000).toFixed(1)}K chars</span>
                      <span>·</span>
                      <span>{new Date(d.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteDoc(d.id, d.filename)}
                    className="p-2 rounded-lg text-[var(--reverb-text-secondary)] hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95"
                    title="Delete document">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {!empty && (
          <div className="mt-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-[12.5px] text-emerald-800">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />
            <span>
              <strong>Brand library is active.</strong> Every chat response now pulls the most relevant chunks from your documents and treats them as authoritative.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl p-3.5"
      style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-sm)" }}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1">{label}</p>
      <p className="text-[20px] font-semibold text-[var(--reverb-text-primary)] tracking-tight">{value}</p>
    </div>
  );
}
