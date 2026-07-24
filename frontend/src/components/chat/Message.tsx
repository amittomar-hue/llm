"use client";

import { useEffect, useRef, useState } from "react";
import { Message as MessageType, ResearchTrace, useChatStore } from "@/lib/chat-store";
import { getModel } from "@/lib/models";
import { submitFeedback, streamChat } from "@/lib/stream-chat";
import { downloadAs, FORMAT_LABELS, type ExportFormat } from "@/lib/export";
import Image from "next/image";
import { Copy, ThumbsUp, ThumbsDown, RotateCcw, Check, Download, Pencil, ChevronDown, Loader2, Globe, BookOpen, Database, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import Markdown from "./Markdown";

export default function Message({ message }: { message: MessageType }) {
  const updateMessage = useChatStore((s) => s.updateMessage);
  const addMessage = useChatStore((s) => s.addMessage);
  const truncateAfter = useChatStore((s) => s.truncateAfter);
  const activeId = useChatStore((s) => s.activeId);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const webSearchForced = useChatStore((s) => s.webSearchForced);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // User-message editing state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [resubmitting, setResubmitting] = useState(false);
  const editTaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && editTaRef.current) {
      editTaRef.current.focus();
      editTaRef.current.setSelectionRange(editTaRef.current.value.length, editTaRef.current.value.length);
    }
  }, [editing]);

  useEffect(() => {
    if (!editing && editTaRef.current) return;
    if (editTaRef.current) {
      editTaRef.current.style.height = "auto";
      editTaRef.current.style.height = Math.min(editTaRef.current.scrollHeight, 320) + "px";
    }
  }, [draft, editing]);

  if (message.role === "user") {
    const startEdit = () => {
      if (message.isStreaming) return;
      setDraft(message.content);
      setEditing(true);
    };
    const cancelEdit = () => {
      setEditing(false);
      setDraft(message.content);
    };
    const submitEdit = async () => {
      const next = draft.trim();
      if (!next || !activeId || resubmitting) return;
      if (next === message.content.trim()) { setEditing(false); return; }

      setResubmitting(true);
      // 1. Update the user message in-place
      updateMessage(activeId, message.id, { content: next });
      // 2. Drop every message that came AFTER this one
      truncateAfter(activeId, message.id);
      // 3. Add a fresh assistant placeholder
      const asstId = addMessage(activeId, {
        role: "assistant",
        content: "",
        model: selectedModel,
        isStreaming: true,
      });
      setEditing(false);

      try {
        const conv = useChatStore.getState().conversations.find((c) => c.id === activeId);
        const history = conv?.messages.filter((m) => m.id !== asstId) ?? [];
        const { text, interactionId } = await streamChat({
          messages: history,
          model: selectedModel,
          webSearchMode: webSearchForced,
          onToken: (acc) => updateMessage(activeId, asstId, { content: acc }),
        });
        updateMessage(activeId, asstId, {
          content: text,
          isStreaming: false,
          interactionId: interactionId ?? undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        updateMessage(activeId, asstId, { content: `⚠️ ${msg}`, isStreaming: false });
      } finally {
        setResubmitting(false);
      }
    };
    const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitEdit(); }
    };

    if (editing) {
      return (
        <div className="flex justify-end reverb-fade-in">
          <div
            className="w-full max-w-[92%] sm:max-w-[80%] rounded-[20px] px-3.5 sm:px-4 py-2.5 sm:py-3 text-[14px] sm:text-[15px] text-[var(--reverb-text-primary)] leading-relaxed"
            style={{
              background: "linear-gradient(135deg, #f3eee6 0%, #ebe5da 100%)",
              border: "1px solid var(--reverb-accent)",
              boxShadow: "var(--reverb-shadow-md)",
            }}
          >
            <textarea
              ref={editTaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              className="w-full bg-transparent resize-none outline-none border-0 text-[14px] sm:text-[15px] leading-relaxed placeholder:text-[var(--reverb-text-tertiary)]"
              placeholder="Edit your message…"
              disabled={resubmitting}
            />
            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[rgba(165,138,110,0.2)]">
              <span className="text-[10.5px] text-[var(--reverb-text-tertiary)] mr-auto">
                Cmd/Ctrl + Enter to regenerate · Esc to cancel
              </span>
              <button
                onClick={cancelEdit}
                disabled={resubmitting}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[var(--reverb-text-secondary)] hover:bg-white/60 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                disabled={resubmitting || draft.trim().length === 0}
                className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold reverb-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resubmitting ? "Sending…" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-end items-start gap-1.5 reverb-fade-in group/user">
        {/* Edit button — appears on hover, sits to the left of the bubble */}
        <button
          onClick={startEdit}
          title="Edit message"
          className="opacity-0 group-hover/user:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] hover:text-[var(--reverb-text-primary)] mt-1.5 shrink-0"
        >
          <Pencil size={13} />
        </button>
        <div
          className="max-w-[90%] sm:max-w-[80%] rounded-[20px] px-4 sm:px-5 py-2.5 sm:py-3 text-[14px] sm:text-[15px] text-[var(--reverb-text-primary)] whitespace-pre-wrap leading-relaxed break-words"
          style={{
            background: "linear-gradient(135deg, #f3eee6 0%, #ebe5da 100%)",
            border: "1px solid rgba(165, 138, 110, 0.15)",
            boxShadow: "var(--reverb-shadow-sm)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const model = message.model ? getModel(message.model) : null;

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const regenerate = async () => {
    if (!activeId || regenerating || message.isStreaming) return;
    const state = useChatStore.getState();
    const conv = state.conversations.find((c) => c.id === activeId);
    if (!conv) return;

    // Build the history UP TO (but not including) this assistant message
    const idx = conv.messages.findIndex((m) => m.id === message.id);
    if (idx < 1) return; // need at least one prior message (the user prompt)
    const history = conv.messages.slice(0, idx);

    setRegenerating(true);
    // Reset the current assistant message
    updateMessage(activeId, message.id, {
      content: "",
      isStreaming: true,
      interactionId: undefined,
      userRating: null,
      model: selectedModel,
    });

    try {
      const { text, interactionId } = await streamChat({
        messages: history,
        model: selectedModel,
        webSearchMode: webSearchForced,
        onToken: (acc) => updateMessage(activeId, message.id, { content: acc }),
      });
      updateMessage(activeId, message.id, {
        content: text,
        isStreaming: false,
        interactionId: interactionId ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(activeId, message.id, {
        content: `⚠️ ${msg}`,
        isStreaming: false,
      });
    } finally {
      setRegenerating(false);
    }
  };

  const download = async () => {
    if (!message.requestedFormat || downloading) return;
    setDownloading(true);
    try {
      // For "convert this to X" follow-ups, the actual export payload is the
      // prior assistant message (stashed in conversionSource), not this
      // message's thin "click below" acknowledgment.
      const payload = message.conversionSource ?? message.content;
      await downloadAs(
        message.requestedFormat as ExportFormat,
        payload,
        message.formatPromptHint ?? payload.slice(0, 40)
      );
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1800);
    } catch (err) {
      console.error("download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const rate = async (rating: 1 | -1) => {
    if (!message.interactionId || !activeId) return;
    if (message.userRating === rating) return;
    updateMessage(activeId, message.id, { userRating: rating });
    try {
      await submitFeedback(message.interactionId, rating);
    } catch (err) {
      console.error("feedback failed:", err);
    }
  };

  return (
    <div className="flex gap-2.5 sm:gap-3 reverb-fade-in">
      <div
        className="relative w-9 h-9 shrink-0 rounded-xl flex items-center justify-center mt-0.5 bg-white p-1.5 overflow-hidden"
        style={{
          border: "1px solid var(--reverb-border-soft)",
          boxShadow: "var(--reverb-shadow-sm)",
        }}
      >
        <Image
          src="/reverb-logo.png"
          alt="Reverb"
          width={64}
          height={20}
          priority
          className="w-full h-auto object-contain"
        />
      </div>

      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-semibold tracking-tight text-[var(--reverb-text-primary)]">
            Reverb
          </span>
          {model && (
            <span className={`text-[11px] font-medium ${model.color} flex items-center gap-1`}>
              <span className="w-1 h-1 rounded-full bg-current" />
              {model.name}
            </span>
          )}
          {message.isStreaming && (
            <span className="flex gap-1 ml-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--reverb-accent)] animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--reverb-accent)] animate-pulse [animation-delay:200ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--reverb-accent)] animate-pulse [animation-delay:400ms]" />
            </span>
          )}
        </div>

        {/* "Think like a human" research trace — rendered above the
            answer body. Streams in live during the planner + executor
            phase, then stays as a collapsible record on the persisted
            message. */}
        {message.researchTrace && message.researchTrace.steps.length > 0 && (
          <ResearchTraceView
            trace={message.researchTrace}
            stillStreamingAnswer={!!message.isStreaming && !message.content}
          />
        )}

        <div className="text-[14px] sm:text-[15px] text-[var(--reverb-text-primary)] break-words">
          <Markdown content={message.content} />
          {message.isStreaming && message.content && (
            <span className="inline-block w-[2px] h-4 bg-[var(--reverb-accent)] ml-0.5 animate-pulse align-middle rounded-sm" />
          )}
        </div>

        {/* Prominent Download CTA: visible when the user explicitly asked for a file format */}
        {!message.isStreaming && message.content && message.requestedFormat && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={download}
              disabled={downloading}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.97]",
                downloaded
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "reverb-btn-primary"
              )}
              title={`Download as ${FORMAT_LABELS[message.requestedFormat as ExportFormat] ?? message.requestedFormat}`}
            >
              {downloaded ? (
                <>
                  <Check size={13} /> Downloaded
                </>
              ) : downloading ? (
                <>
                  <Download size={13} className="animate-pulse" /> Preparing…
                </>
              ) : (
                <>
                  <Download size={13} />
                  Download as {FORMAT_LABELS[message.requestedFormat as ExportFormat] ?? message.requestedFormat.toUpperCase()}
                </>
              )}
            </button>
            <span className="text-[11px] text-[var(--reverb-text-tertiary)]">
              Generated locally · nothing leaves your browser
            </span>
          </div>
        )}

        {!message.isStreaming && message.content && (
          <div className="flex items-center gap-0.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ActionButton onClick={copy} title="Copy" active={copied}>
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            </ActionButton>
            <ActionButton
              onClick={() => rate(1)}
              title="Good response — saves as a learning example"
              active={message.userRating === 1}
              activeColor="text-emerald-600 bg-emerald-50"
              disabled={!message.interactionId}
            >
              <ThumbsUp size={13} />
            </ActionButton>
            <ActionButton
              onClick={() => rate(-1)}
              title="Bad response — won't be used as a future example"
              active={message.userRating === -1}
              activeColor="text-red-500 bg-red-50"
              disabled={!message.interactionId}
            >
              <ThumbsDown size={13} />
            </ActionButton>
            <ActionButton
              onClick={regenerate}
              title="Regenerate response"
              disabled={regenerating || message.isStreaming}
            >
              <RotateCcw size={13} className={regenerating ? "animate-spin" : ""} />
            </ActionButton>
            {message.interactionId && (
              <span className="ml-2 text-[10px] text-[var(--reverb-text-tertiary)] font-mono tracking-tight">
                {message.interactionId.slice(0, 8)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  title,
  active = false,
  activeColor = "",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded-lg transition-all duration-150 active:scale-90",
        active && activeColor ? activeColor : "text-[var(--reverb-text-secondary)] hover:bg-[#f5f1ea]",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Visible "thinking" trace rendered above each assistant message
// body when the planner produced a research plan. Shows the distilled
// intent as a header, then each step as a one-line row that flips
// from spinner → checkmark as the executor completes it. Collapsible
// once the answer body has finished streaming so old messages aren't
// dominated by the trace.
// ─────────────────────────────────────────────────────────────────
function ResearchTraceView({
  trace,
  stillStreamingAnswer,
}: {
  trace: ResearchTrace;
  stillStreamingAnswer: boolean;
}) {
  const allDone = trace.steps.every((s) => s.status === "done");
  // Auto-expand while research is in flight or the answer hasn't started;
  // once the answer streams, collapse by default but stay clickable.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (allDone && !stillStreamingAnswer) setOpen(false);
  }, [allDone, stillStreamingAnswer]);

  const iconForKind = (kind: string) => {
    switch (kind) {
      case "web_search": return Globe;
      case "brand_voice": return BookOpen;
      case "training_pairs": return Database;
      default: return Target;
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-[var(--reverb-border-soft)] bg-[#faf6ef]/60 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#faf6ef] transition-colors"
      >
        <span className="w-5 h-5 rounded-md bg-[var(--reverb-accent)]/10 flex items-center justify-center shrink-0">
          {allDone ? (
            <Check size={11} className="text-[var(--reverb-accent)]" strokeWidth={2.6} />
          ) : (
            <Loader2 size={11} className="text-[var(--reverb-accent)] animate-spin" strokeWidth={2.4} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--reverb-text-tertiary)]">
            {allDone ? "Thought it through" : "Thinking…"}
          </p>
          <p className="text-[12.5px] font-medium text-[var(--reverb-text-primary)] truncate italic">
            {trace.intent || "Letting me think this one through"}
          </p>
        </div>
        <ChevronDown
          size={13}
          className="text-[var(--reverb-text-tertiary)] shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <ul className="border-t border-[var(--reverb-border-soft)] divide-y divide-[var(--reverb-border-soft)]">
          {trace.steps.map((step, i) => {
            const Icon = iconForKind(step.kind);
            return (
              <li key={`${step.kind}-${i}`} className="flex items-start gap-2.5 px-3 py-2">
                <span className="w-5 h-5 rounded-md bg-white border border-[var(--reverb-border-soft)] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={11} className="text-[var(--reverb-text-secondary)]" strokeWidth={2.2} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[var(--reverb-text-primary)] leading-snug">
                    {step.label}
                  </p>
                  {step.status === "done" && step.result && (
                    <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] mt-0.5 truncate">
                      {step.result}
                    </p>
                  )}
                </div>
                <span className="shrink-0 mt-1">
                  {step.status === "done" ? (
                    <Check size={11} className="text-emerald-600" strokeWidth={2.6} />
                  ) : (
                    <Loader2 size={11} className="text-[var(--reverb-accent)] animate-spin" strokeWidth={2.4} />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

