"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ModelId, DEFAULT_MODEL } from "./models";
import { createSupabaseBrowserClient } from "./supabase-browser";

export interface ResearchTraceStep {
  kind: "intent" | "web_search" | "brand_voice" | "training_pairs";
  label: string;
  status: "started" | "done";
  result?: string;
}

export interface ResearchTrace {
  /** One-line distilled intent (what the user really wants), produced by the planner. */
  intent: string;
  steps: ResearchTraceStep[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: ModelId;
  createdAt: Date | string;
  isStreaming?: boolean;
  interactionId?: string;
  userRating?: 1 | -1 | null;
  /** Legacy single-attachment field — preserved on existing messages,
   *  not written on new sends. Multi-file uploads use attachmentNames. */
  attachmentName?: string;
  /** Multi-file attachment names (e.g. ["a.pdf", "b.docx"]) for messages
   *  that bundled more than one file. Display layer renders both this
   *  and the legacy attachmentName field, so old conversations don't
   *  lose their attachment chips after this rollout. */
  attachmentNames?: string[];
  /** "Think like a human" research trace — populated by the planner +
   *  executor pass that runs BEFORE the main answer model. Shown above
   *  the answer body as a visible thinking block. Only present on
   *  assistant messages. Each step's status flips started → done as
   *  the executor runs them in order. */
  researchTrace?: ResearchTrace;
  /** If the user asked for a specific file format (pdf/docx/xlsx/pptx/csv/json/md/txt/html), it's stored here so the assistant message can show a Download button. */
  requestedFormat?: string;
  /** The verbatim text used to derive the filename when downloading. */
  formatPromptHint?: string;
  /** For "convert this to X" follow-ups: the prior message's content used as the actual export payload (so the downloadable file contains the real answer, not the thin acknowledgment text). */
  conversionSource?: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: ModelId;
  messages: Message[];
  createdAt: Date | string;
  updatedAt: Date | string;
  /** Brand Agent this conversation is grounded in. NULL = use the user's
   *  default agent (legacy conversations + brand-new chats before the
   *  user picks an agent). Server column is chat_conversations.agent_id. */
  agentId?: string | null;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  selectedModel: ModelId;
  webSearchForced: "auto" | "on" | "off";
  /** Image generation: "on" → embed AI-generated images inline in visual
   *  creative responses. "off" → text-only output, skip the image step.
   *  Default "on" so visual asks (social posts, ads) get visuals by default
   *  while quick iteration ("shorter", "in US English") doesn't pay the
   *  ~5s image latency. Persisted so the toggle survives reloads. */
  imageMode: "on" | "off";
  /** Visual style applied to inline-generated images. Picker exposes the
   *  three styles the system prompt knows how to render distinctively:
   *  "photo" = professional photography of real people (the new default),
   *  "3d" = stylized 3D render (Stripe/Linear aesthetic), "illustration" =
   *  flat 2D modern brand illustration (Mailchimp/Slack aesthetic). */
  imageStyle: "photo" | "3d" | "illustration";
  /** Output language — "auto" means follow the language of the user's
   *  most recent message (per the LANGUAGE CONTRACT in the system prompt).
   *  Explicit BCP-47 codes ("es", "fr", "hi", "pt-BR", etc.) force the
   *  model to respond in that language regardless of what the user typed.
   *  Useful for marketing agencies producing creative for global markets
   *  ("draft this LinkedIn post in Brazilian Portuguese"). Also drives the
   *  Web Speech API's recognition.lang so voice input works in the chosen
   *  language. */
  outputLanguage: string;
  /** True once the user has either picked a language manually OR the
   *  first-load auto-detection has tried to map navigator.language. Lets
   *  us run the browser-language detection exactly once per browser
   *  instead of overriding the user's explicit "Auto" choice every load. */
  languageInitialized: boolean;
  /** All files the user has attached but not yet sent. Replaces the
   *  single pendingAttachment from the pre-multi-file era. Lives only
   *  in-memory (not in the persist partialize list) so it resets on
   *  page reload — staging area only. */
  pendingAttachments: Array<{ name: string; content: string }>;
  /** Auth user the store is currently bound to. null = signed out / not yet hydrated. */
  userId: string | null;
  /** True while the initial server fetch is in flight (sidebar shows a skeleton). */
  isHydrating: boolean;
  setModel: (model: ModelId) => void;
  setWebSearchMode: (mode: "auto" | "on" | "off") => void;
  setImageMode: (mode: "on" | "off") => void;
  setImageStyle: (style: "photo" | "3d" | "illustration") => void;
  setOutputLanguage: (lang: string) => void;
  /** Called by ChatLayout's first-mount effect to flip the
   *  languageInitialized flag without changing outputLanguage — used when
   *  the browser-language detection produced no match and we still want
   *  to stop retrying on subsequent loads. */
  markLanguageInitialized: () => void;
  /** Append a single attachment to the staged list (called once per
   *  file when the user selects multiple files at once, or one at a
   *  time across separate clicks). De-dupes by filename. */
  addPendingAttachment: (att: { name: string; content: string }) => void;
  /** Remove a single staged attachment by filename. */
  removePendingAttachment: (name: string) => void;
  /** Clear every staged attachment — fires after a successful send. */
  clearPendingAttachments: () => void;
  newConversation: () => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setActive: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) => string;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void;
  /** Drop every message strictly AFTER the given message id. Used when a user
   *  edits an earlier prompt — the assistant reply (and any follow-ups) get
   *  removed so the new regenerated response can replace them. */
  truncateAfter: (conversationId: string, messageId: string) => void;
  /** Bind / re-bind a conversation to a Brand Agent. Set to null to clear
   *  the binding (which makes retrieval fall back to the user's default
   *  agent in the chat route). */
  setConversationAgent: (conversationId: string, agentId: string | null) => void;
  activeConversation: () => Conversation | null;
  clearAll: () => void;
  /** Replace in-memory conversations with the user's rows from Supabase.
   *  Idempotent — safe to call repeatedly on auth state change. Existing
   *  localStorage-only chats are discarded (server is authoritative). */
  hydrateFromServer: (userId: string) => Promise<void>;
  /** Wipe in-memory state when the user signs out, so the next user
   *  doesn't briefly see the previous user's conversations. */
  unbind: () => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

// ─────────────────────────────────────────────────────────────────
// Server sync: each conversation is a single row keyed by its id
// in the chat_conversations table. Writes are debounced per-conversation
// so a burst of updateMessage calls during streaming only produces
// one network round-trip when the stream settles.
// ─────────────────────────────────────────────────────────────────

const SYNC_DEBOUNCE_MS = 600;
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSync(conversationId: string) {
  if (typeof window === "undefined") return;
  const existing = syncTimers.get(conversationId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    syncTimers.delete(conversationId);
    void syncConversationToServer(conversationId);
  }, SYNC_DEBOUNCE_MS);
  syncTimers.set(conversationId, t);
}

async function syncConversationToServer(conversationId: string) {
  const state = useChatStore.getState();
  const userId = state.userId;
  if (!userId) return;
  const convo = state.conversations.find((c) => c.id === conversationId);
  if (!convo) return;

  const sb = createSupabaseBrowserClient();
  // Don't sync a streaming message — wait for the stream to settle.
  // Streaming messages flip isStreaming back to undefined when the
  // chat route finishes, at which point the next scheduleSync fires.
  const hasStreaming = convo.messages.some((m) => m.isStreaming);
  if (hasStreaming) {
    scheduleSync(conversationId);
    return;
  }

  const updatedAtIso =
    convo.updatedAt instanceof Date ? convo.updatedAt.toISOString() : new Date(convo.updatedAt).toISOString();
  const createdAtIso =
    convo.createdAt instanceof Date ? convo.createdAt.toISOString() : new Date(convo.createdAt).toISOString();

  const { error } = await sb.from("chat_conversations").upsert(
    {
      id: convo.id,
      user_id: userId,
      title: convo.title,
      model: convo.model,
      data: convo,
      agent_id: convo.agentId ?? null,
      created_at: createdAtIso,
      updated_at: updatedAtIso,
    },
    { onConflict: "id" }
  );
  if (error) {
    console.error("chat-store: sync upsert failed", error.message);
  }
}

async function deleteConversationOnServer(conversationId: string) {
  const userId = useChatStore.getState().userId;
  if (!userId) return;
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) console.error("chat-store: delete failed", error.message);
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      selectedModel: DEFAULT_MODEL,
      webSearchForced: "auto",
      imageMode: "on",
      imageStyle: "photo",
      outputLanguage: "auto",
      languageInitialized: false,
      pendingAttachments: [],
      userId: null,
      isHydrating: false,

      setModel: (model) => set({ selectedModel: model }),
      setWebSearchMode: (mode) => set({ webSearchForced: mode }),
      setImageMode: (mode) => set({ imageMode: mode }),
      setImageStyle: (style) => set({ imageStyle: style }),
      setOutputLanguage: (lang) => set({ outputLanguage: lang, languageInitialized: true }),
      markLanguageInitialized: () => set({ languageInitialized: true }),
      addPendingAttachment: (att) =>
        set((s) => ({
          // De-dupe by filename — reattaching the same file is a no-op
          // rather than landing the user with two identical chips.
          pendingAttachments: s.pendingAttachments.some((a) => a.name === att.name)
            ? s.pendingAttachments
            : [...s.pendingAttachments, att],
        })),
      removePendingAttachment: (name) =>
        set((s) => ({
          pendingAttachments: s.pendingAttachments.filter((a) => a.name !== name),
        })),
      clearPendingAttachments: () => set({ pendingAttachments: [] }),

      newConversation: () => {
        const id = uid();
        const conv: Conversation = {
          id,
          title: "New conversation",
          model: get().selectedModel,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((s) => ({ conversations: [conv, ...s.conversations], activeId: id }));
        scheduleSync(id);
        return id;
      },

      deleteConversation: (id) => {
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        }));
        void deleteConversationOnServer(id);
      },

      renameConversation: (id, title) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: new Date() } : c
          ),
        }));
        scheduleSync(id);
      },

      setActive: (id) => {
        set({ activeId: id });
        // Sync the agent-store's selectedAgentId to the newly-active
        // conversation's binding so a subsequent brand-agent pick doesn't
        // race against a stale selectedAgentId. Without this, the chat
        // input and header can silently disagree about which agent is
        // active — which surfaced as "the response ignored the brand
        // agent" after a sidebar-switch. Dynamic import avoids a circular
        // module cycle at load time.
        if (typeof window !== "undefined") {
          void import("./agent-store").then(({ useAgentStore }) => {
            const conv = get().conversations.find((c) => c.id === id);
            if (conv?.agentId) {
              useAgentStore.getState().setSelected(conv.agentId);
            }
          });
        }
      },

      addMessage: (conversationId, msg) => {
        const id = uid();
        const message: Message = { ...msg, id, createdAt: new Date() };
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  title:
                    c.messages.length === 0 && msg.role === "user"
                      ? msg.content.slice(0, 48) + (msg.content.length > 48 ? "…" : "")
                      : c.title,
                  updatedAt: new Date(),
                }
              : c
          ),
        }));
        scheduleSync(conversationId);
        return id;
      },

      updateMessage: (conversationId, messageId, patch) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, ...patch } : m
                  ),
                  updatedAt: new Date(),
                }
              : c
          ),
        }));
        scheduleSync(conversationId);
      },

      truncateAfter: (conversationId, messageId) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const idx = c.messages.findIndex((m) => m.id === messageId);
            if (idx < 0) return c;
            return {
              ...c,
              messages: c.messages.slice(0, idx + 1),
              updatedAt: new Date(),
            };
          }),
        }));
        scheduleSync(conversationId);
      },

      setConversationAgent: (conversationId, agentId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, agentId, updatedAt: new Date() }
              : c
          ),
        }));
        scheduleSync(conversationId);
      },

      activeConversation: () => {
        const { conversations, activeId } = get();
        return conversations.find((c) => c.id === activeId) ?? null;
      },

      clearAll: () => set({ conversations: [], activeId: null }),

      // ─────────────────────────────────────────────────────────
      // Cross-device sync: server is authoritative. Replace the
      // in-memory list with whatever Supabase has for this user.
      // Existing localStorage conversations (from before the
      // rollout) are discarded — same-user-same-list on every
      // device beats preserving silo'd browser history.
      // ─────────────────────────────────────────────────────────
      hydrateFromServer: async (userId: string) => {
        // Preserve activeId if it's the same user being re-hydrated —
        // otherwise tabbing away from DMOOP wipes the active conversation
        // every time INITIAL_SESSION / TOKEN_REFRESHED fires. ChatLayout's
        // listener already guards against calling this on transient
        // events, but if some other caller does, this keeps the active
        // chat visible while the server fetch is in flight.
        const prev = get();
        const sameUser = prev.userId === userId;
        const prevActiveId = sameUser ? prev.activeId : null;
        const prevConvos = sameUser ? prev.conversations : [];

        set({
          userId,
          isHydrating: true,
          conversations: prevConvos,
          activeId: prevActiveId,
        });

        const sb = createSupabaseBrowserClient();
        const { data, error } = await sb
          .from("chat_conversations")
          .select("id, data, updated_at")
          .order("updated_at", { ascending: false });

        if (error) {
          console.error("chat-store: hydrate fetch failed", error.message);
          set({ isHydrating: false });
          return;
        }

        const serverConvos: Conversation[] = (data ?? [])
          .map((row) => row.data as Conversation)
          .filter(Boolean);

        // If the previously-active conversation still exists on the
        // server side, keep it active; otherwise null it out so the
        // sidebar can pick something fresh.
        const stillActive =
          prevActiveId && serverConvos.some((c) => c.id === prevActiveId)
            ? prevActiveId
            : null;

        set({
          conversations: serverConvos,
          activeId: stillActive,
          isHydrating: false,
        });
      },

      unbind: () => {
        set({ conversations: [], activeId: null, userId: null });
      },
    }),
    {
      name: "dmoop-chat-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        activeId: state.activeId,
        selectedModel: state.selectedModel,
        webSearchForced: state.webSearchForced,
        imageMode: state.imageMode,
        imageStyle: state.imageStyle,
        outputLanguage: state.outputLanguage,
        languageInitialized: state.languageInitialized,
      }),
      version: 1,
    }
  )
);
