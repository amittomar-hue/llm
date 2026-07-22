"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useChatStore } from "@/lib/chat-store";
import { useAgentStore } from "@/lib/agent-store";
import { streamChat } from "@/lib/stream-chat";
import { detectFormat, isConversionRequest, FORMAT_LABELS, type ExportFormat } from "@/lib/export";
import { parseDocumentClient } from "@/lib/parse-document-client";
import ModelSelector from "./ModelSelector";
import BrandAgent from "./BrandAgent";
import { Paperclip, ArrowUp, Globe, X, FileText, Mic, Image as ImageIcon, ChevronDown, Languages as LanguagesIcon } from "lucide-react";
import { SUPPORTED_LANGUAGES, getLanguage } from "@/lib/languages";
import { cn } from "@/lib/utils";

// Web Speech API types (minimal shim — TypeScript doesn't ship them globally)
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export default function InputBar() {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  // Style picker dropdown for the Images control.
  const [imageStyleOpen, setImageStyleOpen] = useState(false);
  const imageStyleRef = useRef<HTMLDivElement>(null);
  // Output-language picker (Auto + 13 supported languages).
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    activeId, newConversation, addMessage, updateMessage, selectedModel,
    webSearchForced, setWebSearchMode,
    imageMode, setImageMode,
    imageStyle, setImageStyle,
    outputLanguage, setOutputLanguage,
    pendingAttachments, addPendingAttachment, removePendingAttachment, clearPendingAttachments,
  } = useChatStore();
  // Effective agent name: selected (fresh pick) → conversation binding →
  // default-flagged. Priority order matches the message-send resolution
  // below (line ~410) so the chip label always reflects the agent the
  // NEXT message will actually go to. Previous order (conv binding first)
  // caused the chip to briefly show a stale agent after a switch.
  const agentName = useAgentStore((s) => {
    const conv = useChatStore.getState().activeConversation();
    const effectiveId =
      s.selectedAgentId ?? conv?.agentId ?? s.agents.find((a) => a.is_default)?.id ?? null;
    return s.agents.find((a) => a.id === effectiveId)?.name ?? "Brand Agent";
  });

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 280) + "px";
    }
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (imageStyleRef.current && !imageStyleRef.current.contains(e.target as Node)) setImageStyleOpen(false);
      if (languageRef.current && !languageRef.current.contains(e.target as Node)) setLanguageOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const [parsingFile, setParsingFile] = useState(false);

  // ── Voice input via Web Speech API ─────────────────────────────
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Holds the committed, finalized portion of the dictated text
  const baseValueRef = useRef<string>("");
  // Tracks USER INTENT to keep listening (vs the actual API state)
  const wantListeningRef = useRef<boolean>(false);
  // Track recent restart attempts so we don't loop infinitely on real errors
  const restartAttemptsRef = useRef<number>(0);
  const lastSuccessfulSpeechRef = useRef<number>(0);
  // Diagnostic surface: most-recent error code (e.g. "no-speech", "not-allowed")
  // plus a "we haven't heard you" flag so the UI can show an inline warning
  // when the recognizer is open but nothing is reaching the transcript.
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSilent, setVoiceSilent] = useState(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setVoiceSilent(false);
    silenceTimerRef.current = setTimeout(() => {
      if (wantListeningRef.current) setVoiceSilent(true);
    }, 8000);
  };
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    setVoiceSilent(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    setVoiceSupported(true);

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Initial language — gets overridden at toggleVoice time with the
    // user's current outputLanguage selection (or the browser locale
    // when outputLanguage is "auto"). Default here is a safe fallback
    // for users whose browser locale isn't available.
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let finalAddition = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) finalAddition += transcript;
        else interim += transcript;
      }
      if (finalAddition) {
        const trimmed = finalAddition.trim();
        baseValueRef.current = baseValueRef.current
          ? `${baseValueRef.current} ${trimmed}`
          : trimmed;
        lastSuccessfulSpeechRef.current = Date.now();
        restartAttemptsRef.current = 0; // reset on any real speech
      }
      // Any onresult activity (even interim) means audio is reaching the
      // recognizer — reset the silence indicator and re-arm the timer.
      if (finalAddition || interim) {
        armSilenceTimer();
        setVoiceError(null);
      }
      const combined = interim
        ? `${baseValueRef.current} ${interim.trim()}`.trim()
        : baseValueRef.current;
      setValue(combined);
    };

    // Auto-restart on end (browser stops after pauses; we want continuous)
    recognition.onend = () => {
      if (!wantListeningRef.current) {
        setListening(false);
        return;
      }
      // If we ended super fast with no speech captured, back off — avoid loop on errors
      const elapsed = Date.now() - (lastSuccessfulSpeechRef.current || 0);
      if (restartAttemptsRef.current >= 6 && elapsed > 30_000) {
        // 6 consecutive restarts with no successful speech → give up
        wantListeningRef.current = false;
        setListening(false);
        return;
      }
      restartAttemptsRef.current += 1;
      try {
        recognition.start();
      } catch {
        // Already started or otherwise — schedule a slight delay restart
        setTimeout(() => {
          if (!wantListeningRef.current) return;
          try { recognition.start(); } catch {}
        }, 250);
      }
    };

    recognition.onerror = (e) => {
      // Always surface the latest error code in the UI — even for
      // "normal" ones like no-speech/aborted, because if those repeat
      // back-to-back the user IS speaking but audio isn't being picked up.
      setVoiceError(e.error);
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "audio-capture" || e.error === "service-not-allowed") {
        wantListeningRef.current = false;
        setListening(false);
        clearSilenceTimer();
        alert(`Microphone error: ${e.error}. Allow microphone access in your browser settings.`);
        return;
      }
      console.warn("speech recognition error:", e.error);
    };

    recognitionRef.current = recognition;
    return () => {
      wantListeningRef.current = false;
      try { recognition.stop(); } catch {}
    };
  }, []);

  const toggleVoice = async () => {
    if (!recognitionRef.current) return;
    if (listening) {
      wantListeningRef.current = false;
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
      clearSilenceTimer();
      return;
    }

    // Pre-check mic permission via getUserMedia. The Web Speech API
    // silently fails ("records but no text appears") when the system
    // mic is muted or no audio device is active — getUserMedia surfaces
    // those problems with explicit error names (NotFoundError, NotAllowedError,
    // NotReadableError) before we hand off to the recognizer. We close
    // the resulting stream immediately; the recognizer opens its own.
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const name = err instanceof Error ? err.name : String(err);
      setVoiceError(name);
      if (name === "NotAllowedError" || name === "SecurityError") {
        alert(
          "Microphone access is blocked. Click the mic icon in your browser's address bar to allow it, then try again."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        alert(
          "No microphone detected. Connect a mic or check your system's input device settings."
        );
      } else if (name === "NotReadableError") {
        alert(
          "Microphone is in use by another app. Close other apps using the mic (Teams, Zoom, Meet) and try again."
        );
      } else {
        alert(`Microphone error: ${name}`);
      }
      return;
    }

    baseValueRef.current = value.trim();
    restartAttemptsRef.current = 0;
    lastSuccessfulSpeechRef.current = Date.now();
    wantListeningRef.current = true;
    // Sync recognition.lang with the picker each time the user toggles
    // voice on — they might have changed languages since the last
    // recording session. Auto → browser locale; explicit code → the
    // BCP-47 region-tagged voice code from SUPPORTED_LANGUAGES.
    const targetLang = outputLanguage === "auto"
      ? (typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US")
      : getLanguage(outputLanguage).voice;
    recognitionRef.current.lang = targetLang;
    try {
      recognitionRef.current.start();
      setListening(true);
      armSilenceTimer();
      setTimeout(() => taRef.current?.focus(), 50);
    } catch (err) {
      wantListeningRef.current = false;
      setListening(false);
      const msg = err instanceof Error ? err.message : String(err);
      setVoiceError(msg);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const oversize = files.find((f) => f.size > 50 * 1024 * 1024);
    if (oversize) {
      alert(`"${oversize.name}" is too large. Max 50MB per file.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setParsingFile(true);
    try {
      // Parse all selected files in parallel client-side. Bypasses
      // Vercel's 4.5MB request body limit (413) per file and keeps the
      // binaries on the user's machine — only extracted text travels.
      const results = await Promise.all(
        files.map(async (file) => {
          try {
            const result = await parseDocumentClient(file);
            return { file, result };
          } catch (err) {
            return {
              file,
              result: { ok: false as const, error: err instanceof Error ? err.message : String(err) },
            };
          }
        })
      );

      const failed: string[] = [];
      for (const { file, result } of results) {
        if (!result.ok) {
          failed.push(`${file.name}: ${result.error}`);
          continue;
        }
        addPendingAttachment({ name: file.name, content: result.text });
      }
      if (failed.length > 0) {
        alert(`Some files failed to parse:\n\n${failed.join("\n")}`);
      }
    } finally {
      setParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const send = async () => {
    const text = value.trim();
    if (!text && pendingAttachments.length === 0) return;

    // Stop any in-progress voice recognition
    if (listening && recognitionRef.current) {
      wantListeningRef.current = false;
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
      clearSilenceTimer();
    }
    baseValueRef.current = "";
    restartAttemptsRef.current = 0;

    let convId = activeId;
    if (!convId) convId = newConversation();

    // Compose the user message — prefix all attachments, one block per
    // file separated by a horizontal rule, then the user's typed text
    // at the end. Format mirrors the previous single-file behaviour so
    // the LLM treats each attachment as an authoritative source.
    const attachmentBlocks = pendingAttachments
      .map((a) => `[Attached: ${a.name}]\n${a.content}`)
      .join("\n\n---\n\n");
    const userContent =
      pendingAttachments.length > 0
        ? `${attachmentBlocks}\n\n---\n\n${text}`
        : text;
    const attachmentNamesForMessage =
      pendingAttachments.length > 0 ? pendingAttachments.map((a) => a.name) : undefined;

    // Detect requested output format (pdf/docx/xlsx/pptx/csv/json/md/txt/html)
    const requestedFormat = detectFormat(text) ?? undefined;

    // SHORT-CIRCUIT: "convert this into <format>" — don't re-call the LLM.
    // Take the previous assistant message's content and offer it as a
    // download in the requested format directly.
    if (requestedFormat && isConversionRequest(text)) {
      const conv = useChatStore.getState().conversations.find((c) => c.id === convId);
      const priorAssistant = [...(conv?.messages ?? [])].reverse().find(
        (m) => m.role === "assistant" && m.content && !m.isStreaming
      );
      if (priorAssistant) {
        addMessage(convId, {
          role: "user",
          content: userContent,
          attachmentNames: attachmentNamesForMessage,
        });
        setValue("");
        clearPendingAttachments();
        const label = FORMAT_LABELS[requestedFormat as ExportFormat] ?? requestedFormat.toUpperCase();
        addMessage(convId, {
          role: "assistant",
          content: `Here's the previous answer ready as **${label}**. Click the green button below to download it.`,
          model: selectedModel,
          isStreaming: false,
          requestedFormat,
          formatPromptHint: text,
          conversionSource: priorAssistant.content,
        });
        return;
      }
    }

    addMessage(convId, {
      role: "user",
      content: userContent,
      attachmentNames: attachmentNamesForMessage,
    });
    setValue("");
    const attachmentsForThisMessage = pendingAttachments;
    clearPendingAttachments();

    const asstId = addMessage(convId, {
      role: "assistant",
      content: "",
      model: selectedModel,
      isStreaming: true,
      requestedFormat,
      formatPromptHint: requestedFormat ? text : undefined,
    });

    try {
      const conv = useChatStore.getState().conversations.find((c) => c.id === convId);
      const history = conv?.messages.filter((m) => m.id !== asstId) ?? [];
      // Resolve agent: fresh session pick wins over conversation binding.
      // Previous order (conv.agentId first) caused stale-binding bugs when
      // users switched agents mid-chat — the setActive/setConversationAgent
      // update path had a race where the request read an unsynced value.
      // Preferring selectedAgentId — which pickAgent updates synchronously
      // — guarantees the freshest user intent goes to the server. Falls
      // back to conv binding for the very first message on a fresh page
      // load (before the user has touched the picker).
      const selectedAgentId = useAgentStore.getState().selectedAgentId;
      const agentId = selectedAgentId ?? conv?.agentId ?? null;
      // eslint-disable-next-line no-console
      console.debug("[chat] sending agent_id=", agentId, "(selected=", selectedAgentId, "conv=", conv?.agentId, ")");
      const { text: final, interactionId, researchTrace } = await streamChat({
        messages: history,
        model: selectedModel,
        webSearchMode: webSearchForced,
        requestedFormat,
        agentId,
        imageMode,
        imageStyle,
        outputLanguage,
        onToken: (acc) => updateMessage(convId!, asstId, { content: acc }),
        // Live-updates the visible thinking trace on the assistant
        // message as the planner emits research markers. The Message
        // component renders this above the answer body.
        onResearch: (trace) => updateMessage(convId!, asstId, { researchTrace: trace }),
      });
      updateMessage(convId, asstId, {
        content: final,
        isStreaming: false,
        interactionId: interactionId ?? undefined,
        researchTrace: researchTrace ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(convId, asstId, {
        content: `⚠️ ${msg}`,
        isStreaming: false,
      });
    }
    void attachmentsForThisMessage;
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasValue = value.trim().length > 0 || pendingAttachments.length > 0;

  // Two-state toggle behavior (previously three-state cycle: auto→on→off→auto).
  // The "auto" middle state made "Search Off → click → Search On" take two
  // clicks, which is what users kept hitting. Now: if search is explicitly on,
  // one click turns it off; from any other state (off OR the initial auto
  // default), one click turns it on. Auto stays as the fresh-session default
  // so smart-search still fires until the user first touches the button.
  const cycleWebSearch = () => {
    setWebSearchMode(webSearchForced === "on" ? "off" : "on");
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 pb-3 pt-1">
      {/* Voice diagnostic — shows when the recognizer is listening but
          no audio is reaching it for 8+ seconds, or when an error fired.
          Surfaces the actual error code so users can self-diagnose. */}
      {(voiceSilent || voiceError) && listening && (
        <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[12px]">
          <Mic size={12} className="text-amber-600 shrink-0" />
          <p className="text-[var(--dmoop-text-primary)] flex-1 leading-snug">
            {voiceError === "no-speech" || voiceSilent ? (
              <>
                <strong>We can&apos;t hear you.</strong> Check your system mic isn&apos;t muted and that the right input device is selected.
              </>
            ) : voiceError === "not-allowed" ? (
              <>
                <strong>Mic blocked.</strong> Allow mic access in the address bar lock icon.
              </>
            ) : voiceError === "audio-capture" ? (
              <>
                <strong>No mic detected.</strong> Connect a microphone and retry.
              </>
            ) : voiceError ? (
              <>
                Speech recognition error: <code className="font-mono text-[11px] bg-white/60 px-1 rounded">{voiceError}</code>
              </>
            ) : null}
          </p>
        </div>
      )}

      {/* Pending attachment chips — one row per file. Each has its own
          X to remove individually so you can drop a wrong file without
          losing the rest. */}
      {pendingAttachments.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {pendingAttachments.length > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)]">
                {pendingAttachments.length} files attached
              </p>
              <button
                onClick={clearPendingAttachments}
                className="text-[10.5px] font-medium text-[var(--dmoop-text-tertiary)] hover:text-[var(--dmoop-text-primary)] transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
          {pendingAttachments.map((a) => (
            <div
              key={a.name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] shadow-[var(--dmoop-shadow-xs)] text-[12.5px]"
            >
              <FileText size={12} className="text-[var(--dmoop-accent)] shrink-0" />
              <span className="font-medium text-[var(--dmoop-text-primary)] truncate flex-1">
                {a.name}
              </span>
              <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)] shrink-0">
                {(a.content.length / 1024).toFixed(1)}KB
              </span>
              <button
                onClick={() => removePendingAttachment(a.name)}
                className="p-0.5 rounded-md hover:bg-[#f0ede8] transition-colors shrink-0"
                title={`Remove ${a.name}`}
              >
                <X size={12} className="text-[var(--dmoop-text-secondary)]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`relative rounded-[20px] sm:rounded-[24px] transition-all duration-300 ease-out dmoop-input-elev ${
          isFocused ? "scale-[1.005]" : ""
        }`}
      >
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-[20px] sm:rounded-t-[24px] pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent 10%, rgba(193,74,42,0.25) 50%, transparent 90%)",
          }}
        />

        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="How can DMOOP help you today?"
          className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] text-[var(--dmoop-text-primary)] placeholder:text-[var(--dmoop-text-tertiary)] focus:outline-none leading-relaxed"
        />

        <div className="flex items-center justify-between px-2 sm:px-3 pb-3 pt-1.5 gap-1.5 sm:gap-2 min-w-0">
          {/* Left controls — buttons are shrink-0 + whitespace-nowrap so
              they keep their natural width and can't wrap text mid-label.
              No overflow-x: that gotcha-clips the y-axis too per CSS spec
              and hides absolute-positioned dropdowns (the Images style
              picker, Language picker) above the row. min-w-0 + flex-1
              lets the row share width with the right-side group without
              expanding past it. */}
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 flex-1">
            {/* Attach */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md,.csv,.tsv,.json,.log,.html,.htm,.xml,.yml,.yaml,.rtf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingFile}
              className={cn(
                "p-1.5 sm:p-2 rounded-lg text-[var(--dmoop-text-secondary)] transition-all duration-150 hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)] active:scale-95 shrink-0",
                pendingAttachments.length > 0 && "text-[var(--dmoop-accent)] bg-[#fbf3ee]",
                parsingFile && "opacity-60 cursor-wait"
              )}
              title="Attach one or more files — PDF, Word, Excel, PowerPoint, text (max 50MB each)"
            >
              {parsingFile ? (
                <span className="block w-3.5 h-3.5 border-2 border-[var(--dmoop-accent)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Paperclip size={14} strokeWidth={2} />
              )}
            </button>

            {/* Search toggle */}
            <button
              type="button"
              onClick={cycleWebSearch}
              className={cn(
                "flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 active:scale-95 shrink-0 whitespace-nowrap",
                webSearchForced === "on"
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : webSearchForced === "off"
                  ? "text-[var(--dmoop-text-tertiary)] hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-secondary)]"
                  : "text-[var(--dmoop-text-secondary)] hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)]"
              )}
              title={
                webSearchForced === "auto" ? "Search: Auto (smart)" :
                webSearchForced === "on" ? "Search: Always on" :
                "Search: Off (no web)"
              }
            >
              <Globe size={13} strokeWidth={2} />
              <span className="font-medium hidden sm:inline">
                Search{webSearchForced === "on" ? " · On" : webSearchForced === "off" ? " · Off" : ""}
              </span>
            </button>

            {/* Images toggle + style picker — controls whether the chat
                embeds AI-generated images and which visual style. Single
                pill with the icon (click = on/off toggle) and a chevron
                (click = open style dropdown) sharing one button row. */}
            <div ref={imageStyleRef} className="relative flex items-stretch shrink-0">
              <button
                type="button"
                onClick={() => setImageMode(imageMode === "on" ? "off" : "on")}
                className={cn(
                  "flex items-center gap-1.5 pl-2 pr-1.5 sm:pl-2.5 sm:pr-1.5 py-1.5 rounded-l-lg text-[13px] transition-all duration-150 active:scale-95 shrink-0 whitespace-nowrap",
                  imageMode === "on"
                    ? "bg-violet-50 text-violet-700 hover:bg-violet-100"
                    : "text-[var(--dmoop-text-tertiary)] hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-secondary)]"
                )}
                title={
                  imageMode === "on"
                    ? `Images: On · style ${imageStyle === "3d" ? "3D" : imageStyle === "illustration" ? "Illustration" : "Photo"}`
                    : "Images: Off (text only)"
                }
              >
                <ImageIcon size={13} strokeWidth={2} />
                <span className="font-medium hidden sm:inline">
                  Images{imageMode === "off" ? " · Off" : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setImageStyleOpen((o) => !o)}
                disabled={imageMode === "off"}
                className={cn(
                  "flex items-center px-1 sm:px-1.5 py-1.5 rounded-r-lg text-[13px] transition-all duration-150 active:scale-95 -ml-px shrink-0 whitespace-nowrap",
                  imageMode === "on"
                    ? "bg-violet-50 text-violet-700 hover:bg-violet-100 border-l border-violet-200/70"
                    : "text-[var(--dmoop-text-tertiary)]/50 cursor-not-allowed"
                )}
                title="Pick visual style"
              >
                <ChevronDown size={12} strokeWidth={2.4} />
              </button>
              {imageStyleOpen && imageMode === "on" && (
                <div
                  className="absolute bottom-full mb-1.5 left-0 w-[180px] rounded-xl overflow-hidden z-30 dmoop-scale-in"
                  style={{
                    background: "var(--dmoop-gradient-card)",
                    border: "1px solid var(--dmoop-border-soft)",
                    boxShadow: "var(--dmoop-shadow-xl)",
                  }}
                >
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--dmoop-text-tertiary)]">
                    Visual style
                  </p>
                  {[
                    { value: "photo" as const, label: "Photo", desc: "Real people, magazine quality" },
                    { value: "3d" as const, label: "3D render", desc: "Stripe / Linear aesthetic" },
                    { value: "illustration" as const, label: "Illustration", desc: "Mailchimp / Slack vibe" },
                  ].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        setImageStyle(s.value);
                        setImageStyleOpen(false);
                      }}
                      className={cn(
                        "w-full flex flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
                        imageStyle === s.value
                          ? "bg-[#fbf3ee]"
                          : "hover:bg-[#faf6ef]"
                      )}
                    >
                      <span className="text-[12.5px] font-semibold text-[var(--dmoop-text-primary)] flex items-center gap-1.5 w-full">
                        {s.label}
                        {imageStyle === s.value && (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[var(--dmoop-accent)]">
                            active
                          </span>
                        )}
                      </span>
                      <span className="text-[10.5px] text-[var(--dmoop-text-tertiary)] leading-snug">
                        {s.desc}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Language picker — sets the response output language.
                Auto = follow the user's input language. Explicit picks
                force the model to respond in that language regardless
                of what the user typed. Also drives Web Speech recognition.lang. */}
            <div ref={languageRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setLanguageOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 active:scale-95 shrink-0 whitespace-nowrap",
                  outputLanguage !== "auto"
                    ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "text-[var(--dmoop-text-secondary)] hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)]"
                )}
                title={
                  outputLanguage === "auto"
                    ? "Output language: Auto (match input)"
                    : `Output language: ${getLanguage(outputLanguage).name} (${getLanguage(outputLanguage).nativeName})`
                }
              >
                <LanguagesIcon size={13} strokeWidth={2} />
                <span className="font-medium hidden sm:inline">
                  {outputLanguage === "auto" ? "Auto" : getLanguage(outputLanguage).code.toUpperCase()}
                </span>
              </button>
              {languageOpen && (
                <div
                  className="absolute bottom-full mb-1.5 left-0 w-[240px] max-h-[380px] overflow-y-auto rounded-xl z-30 dmoop-scale-in dmoop-scroll"
                  style={{
                    background: "var(--dmoop-gradient-card)",
                    border: "1px solid var(--dmoop-border-soft)",
                    boxShadow: "var(--dmoop-shadow-xl)",
                  }}
                >
                  <p className="sticky top-0 px-3 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dmoop-text-tertiary)]"
                    style={{ background: "var(--dmoop-gradient-card)" }}>
                    Respond in
                  </p>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setOutputLanguage(l.code);
                        setLanguageOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        outputLanguage === l.code
                          ? "bg-[#fbf3ee]"
                          : "hover:bg-[#faf6ef]"
                      )}
                    >
                      <span className="text-[15px] leading-none shrink-0">{l.flag}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-[var(--dmoop-text-primary)] leading-tight truncate">
                          {l.name}
                        </p>
                        <p className="text-[10.5px] text-[var(--dmoop-text-tertiary)] leading-tight truncate">
                          {l.nativeName}
                        </p>
                      </div>
                      {outputLanguage === l.code && (
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--dmoop-accent)] shrink-0">
                          on
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Brand Agent — assets grounded in user's uploaded docs */}
            <BrandAgent onInsert={(prompt) => {
              setValue((v) => (v ? v + "\n\n" + prompt : prompt));
              setTimeout(() => taRef.current?.focus(), 50);
            }} />

          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ModelSelector />

            {/* Voice — sits just before the submit button on the right */}
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                className={cn(
                  "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95",
                  listening
                    ? "text-white bg-red-500 hover:bg-red-600 shadow-[0_2px_8px_rgba(239,68,68,0.35)]"
                    : "text-[var(--dmoop-text-secondary)] bg-[#f5f1ea]/60 hover:bg-[#f5f1ea] hover:text-[var(--dmoop-text-primary)]"
                )}
                title={listening ? "Stop voice input" : "Voice input"}
              >
                {listening && (
                  <span className="absolute inset-0 rounded-xl bg-red-500/40 animate-ping" />
                )}
                <Mic size={15} strokeWidth={2.2} className="relative" />
                {listening && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>
            )}

            <button
              onClick={send}
              disabled={!hasValue}
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 overflow-hidden ${
                hasValue ? "dmoop-btn-primary" : "bg-[#e8e2d8] text-[#b8ad9f] cursor-not-allowed"
              }`}
            >
              {hasValue && (
                <span
                  className="absolute inset-0 opacity-50"
                  style={{ background: "var(--dmoop-gradient-sheen)" }}
                />
              )}
              <ArrowUp size={16} strokeWidth={2.5} className="relative" />
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-[10.5px] text-[var(--dmoop-text-tertiary)] mt-2 tracking-wide">
        DMOOP generates AI-assisted content. Verify against your brand guidelines before publishing.
      </p>
    </div>
  );
}
