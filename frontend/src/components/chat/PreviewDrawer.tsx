"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X, Eye, Code as CodeIcon, ExternalLink, Download, Maximize2, Minimize2, RefreshCw,
} from "lucide-react";
import { usePreviewStore } from "@/lib/preview-store";
import { wrapHtmlFragment } from "@/lib/preview-detect";
import { cn } from "@/lib/utils";
import Markdown from "./Markdown";

// ─────────────────────────────────────────────────────────────────
// Claude/Gemini-style code preview drawer.
//
// Slides in from the right whenever any code block triggers
// usePreviewStore.openPreview(). Has two tabs:
//   - Preview → renders the artifact (iframe for HTML, inline for SVG,
//               our Markdown component for MD, pretty-print for JSON)
//   - Code    → syntax-coloured source
//
// Width: ~half the viewport on desktop, full on mobile, with a maximize
// toggle. The chat thread stays visible underneath and continues to
// stream new tokens in real-time.
// ─────────────────────────────────────────────────────────────────

export default function PreviewDrawer() {
  const artifact = usePreviewStore((s) => s.artifact);
  const closePreview = usePreviewStore((s) => s.closePreview);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [maximized, setMaximized] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Reset to preview tab + clear maximize when a new artifact opens.
  useEffect(() => {
    if (artifact) {
      setTab("preview");
      setIframeKey((k) => k + 1);
    }
  }, [artifact?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes
  useEffect(() => {
    if (!artifact) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closePreview(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [artifact, closePreview]);

  const filename = useMemo(() => {
    const ext = artifact?.language || "txt";
    const stamp = new Date().toISOString().slice(0, 10);
    return `reverb-artifact-${stamp}.${ext}`;
  }, [artifact?.language]);

  if (!artifact) return null;

  const download = () => {
    const mime =
      artifact.kind === "html" ? "text/html" :
      artifact.kind === "svg"  ? "image/svg+xml" :
      artifact.kind === "json" ? "application/json" :
      artifact.kind === "markdown" ? "text/markdown" :
      "text/plain";
    const blob = new Blob([artifact.code], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openInNewTab = () => {
    if (artifact.kind !== "html" && artifact.kind !== "svg") return;
    const mime = artifact.kind === "html" ? "text/html" : "image/svg+xml";
    const body = artifact.kind === "html" ? wrapHtmlFragment(artifact.code) : artifact.code;
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const refresh = () => setIframeKey((k) => k + 1);

  const previewable = artifact.kind && artifact.kind !== "react";

  return (
    <>
      {/* Backdrop on mobile only — desktop drawer floats over chat */}
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm reverb-fade-in"
        onClick={closePreview}
      />

      <aside
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 bg-white border-l border-[var(--reverb-border-soft)] flex flex-col reverb-slide-in-right",
          maximized
            ? "w-full"
            : "w-full sm:w-[58%] md:w-[600px] lg:w-[720px] xl:w-[780px]"
        )}
        style={{ boxShadow: "var(--reverb-shadow-xl)" }}
      >
        {/* Header */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-[var(--reverb-border-soft)] flex items-center gap-2 bg-[#faf6ef] shrink-0">
          {/* tabs */}
          <div className="flex gap-0.5 p-0.5 bg-white rounded-lg border border-[var(--reverb-border-soft)]">
            <button
              onClick={() => setTab("preview")}
              disabled={!previewable}
              className={cn(
                "px-2.5 sm:px-3 py-1 rounded-md text-[11.5px] sm:text-[12px] font-semibold transition-all flex items-center gap-1.5",
                tab === "preview"
                  ? "bg-[var(--reverb-accent)] text-white shadow-[var(--reverb-shadow-xs)]"
                  : "text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]",
                !previewable && "opacity-40 cursor-not-allowed"
              )}
            >
              <Eye size={12} /> Preview
            </button>
            <button
              onClick={() => setTab("code")}
              className={cn(
                "px-2.5 sm:px-3 py-1 rounded-md text-[11.5px] sm:text-[12px] font-semibold transition-all flex items-center gap-1.5",
                tab === "code"
                  ? "bg-[var(--reverb-accent)] text-white shadow-[var(--reverb-shadow-xs)]"
                  : "text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]"
              )}
            >
              <CodeIcon size={12} /> Code
            </button>
          </div>

          <span className="text-[10px] sm:text-[10.5px] text-[var(--reverb-text-tertiary)] uppercase tracking-wider font-semibold ml-1 truncate">
            {artifact.title ?? artifact.language ?? "code"}
          </span>

          <div className="ml-auto flex items-center gap-0.5">
            {tab === "preview" && artifact.kind === "html" && (
              <button onClick={refresh} title="Reload preview"
                className="p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white hover:text-[var(--reverb-text-primary)] transition-colors">
                <RefreshCw size={13} />
              </button>
            )}
            {(artifact.kind === "html" || artifact.kind === "svg") && (
              <button onClick={openInNewTab} title="Open in new tab"
                className="p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white hover:text-[var(--reverb-text-primary)] transition-colors">
                <ExternalLink size={13} />
              </button>
            )}
            <button onClick={download} title="Download"
              className="p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white hover:text-[var(--reverb-text-primary)] transition-colors">
              <Download size={13} />
            </button>
            <button onClick={() => setMaximized((m) => !m)} title={maximized ? "Restore" : "Maximize"}
              className="hidden sm:inline-flex p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white hover:text-[var(--reverb-text-primary)] transition-colors">
              {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button onClick={closePreview} title="Close"
              className="p-1.5 rounded-md text-[var(--reverb-text-secondary)] hover:bg-white hover:text-[var(--reverb-text-primary)] transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-white">
          {tab === "preview"
            ? <PreviewBody artifact={artifact} iframeKey={iframeKey} />
            : <CodeBody code={artifact.code} language={artifact.language} />
          }
        </div>
      </aside>
    </>
  );
}

function PreviewBody({
  artifact, iframeKey,
}: {
  artifact: { kind: string | null; code: string; language: string };
  iframeKey: number;
}) {
  if (artifact.kind === "html") {
    const doc = wrapHtmlFragment(artifact.code);
    return (
      <iframe
        key={iframeKey}
        srcDoc={doc}
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
        className="w-full h-full bg-white"
        title="HTML preview"
      />
    );
  }

  if (artifact.kind === "svg") {
    return (
      <div
        className="w-full h-full overflow-auto bg-[repeating-conic-gradient(#f1ece4_0deg_90deg,#fbf6ec_90deg_180deg)] bg-[length:16px_16px] flex items-center justify-center p-6"
        dangerouslySetInnerHTML={{ __html: artifact.code }}
      />
    );
  }

  if (artifact.kind === "markdown") {
    return (
      <div className="overflow-auto h-full p-5 sm:p-7 reverb-scroll">
        <Markdown content={artifact.code} />
      </div>
    );
  }

  if (artifact.kind === "json") {
    let pretty = artifact.code;
    try {
      pretty = JSON.stringify(JSON.parse(artifact.code), null, 2);
    } catch {}
    return (
      <pre className="p-5 sm:p-6 overflow-auto h-full text-[12px] sm:text-[12.5px] leading-[1.6] font-mono whitespace-pre text-[var(--reverb-text-primary)] reverb-scroll">
        {pretty}
      </pre>
    );
  }

  return (
    <div className="p-8 text-[13px] text-[var(--reverb-text-tertiary)] text-center">
      Preview not available for this content type. Use the Code tab.
    </div>
  );
}

function CodeBody({ code, language }: { code: string; language: string }) {
  return (
    <pre className="p-4 sm:p-5 overflow-auto h-full text-[11.5px] sm:text-[12.5px] leading-[1.65] font-mono bg-[#1c1815] text-[#e8d9c5] reverb-scroll">
      <code className={`language-${language}`}>{code}</code>
    </pre>
  );
}
