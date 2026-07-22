"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChatStore, Conversation } from "@/lib/chat-store";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { SquarePen, MessageSquare, LogOut, Shield, ChevronUp, X, BookOpen, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

function groupByDate(conversations: Conversation[]) {
  const now = new Date();
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const older: Conversation[] = [];
  for (const c of conversations) {
    const diff = (now.getTime() - new Date(c.updatedAt).getTime()) / 86400000;
    if (diff < 1) today.push(c);
    else if (diff < 2) yesterday.push(c);
    else older.push(c);
  }
  return { today, yesterday, older };
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const router = useRouter();
  const { conversations, activeId, newConversation, setActive } = useChatStore();
  const groups = groupByDate(conversations);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          email: user.email ?? "",
          name: (user.user_metadata?.full_name as string) ?? user.email?.split("@")[0] ?? "User",
        });
      }
    });
    fetch("/api/admin/stats", { method: "GET" })
      .then((r) => setIsAdmin(r.ok))
      .catch(() => setIsAdmin(false));
  }, []);

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleNew = () => {
    newConversation();
    onMobileClose();
  };

  const handleSelect = (id: string) => {
    setActive(id);
    onMobileClose();
  };

  const initials = user?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "U";

  const Section = ({ label, items }: { label: string; items: Conversation[] }) =>
    items.length > 0 ? (
      <div className="mb-3">
        <p className="px-3 py-1.5 text-[10px] font-semibold text-[var(--dmoop-text-tertiary)] uppercase tracking-[0.08em]">{label}</p>
        <div className="flex flex-col gap-0.5">
          {items.map((c, i) => (
            <button key={c.id} onClick={() => handleSelect(c.id)} style={{ animationDelay: `${i * 30}ms` }}
              className={cn(
                "group relative w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] transition-all duration-200 dmoop-stagger-in",
                activeId === c.id
                  ? "bg-white text-[var(--dmoop-text-primary)] shadow-[0_1px_3px_rgba(78,52,32,0.06),0_4px_12px_rgba(78,52,32,0.05)]"
                  : "text-[var(--dmoop-text-secondary)] hover:bg-white/60 hover:translate-x-0.5"
              )}>
              {activeId === c.id && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-[var(--dmoop-accent)]" />}
              <MessageSquare size={13} className="shrink-0 opacity-60" />
              <span className="flex-1 truncate font-medium">{c.title}</span>
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30 dmoop-fade-in"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "shrink-0 flex flex-col h-full border-r border-[var(--dmoop-border-soft)] transition-transform duration-300 ease-out",
          // Desktop: always visible at 268px
          "md:w-[268px] md:translate-x-0 md:static",
          // Mobile: fixed drawer, slides in
          "fixed left-0 top-0 bottom-0 w-[280px] max-w-[85vw] z-40",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: "var(--dmoop-bg-sidebar)" }}
      >
        {/* Logo + new chat */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={120} height={36} priority className="h-8 w-auto" />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleNew}
              className="p-2 rounded-lg text-[var(--dmoop-text-secondary)] transition-all duration-200 hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] hover:text-[var(--dmoop-text-primary)] active:scale-95" title="New conversation">
              <SquarePen size={15} />
            </button>
            <button onClick={onMobileClose}
              className="md:hidden p-2 rounded-lg text-[var(--dmoop-text-secondary)] transition-all duration-200 hover:bg-white active:scale-95" title="Close menu">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="mx-4 mb-3 h-px bg-gradient-to-r from-transparent via-[var(--dmoop-border-soft)] to-transparent" />

        {/* Primary nav — always visible, no nested dropdown */}
        <div className="px-2 mb-2">
          <Link
            href="/brand"
            onClick={onMobileClose}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] text-[var(--dmoop-text-primary)] hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] transition-all duration-200 group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#fbf3ee] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
              style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
              <BookOpen size={14} className="text-[var(--dmoop-accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[13px] tracking-tight">Brand Library</p>
              <p className="text-[10.5px] text-[var(--dmoop-text-tertiary)]">Your brand docs & agent</p>
            </div>
          </Link>
        </div>

        <div className="mx-4 mb-1 h-px bg-gradient-to-r from-transparent via-[var(--dmoop-border-soft)] to-transparent" />

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-2 py-1 dmoop-scroll">
          {conversations.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-[var(--dmoop-text-tertiary)] leading-relaxed">Start a conversation to see it here.</p>
          ) : (
            <>
              <Section label="Today" items={groups.today} />
              <Section label="Yesterday" items={groups.yesterday} />
              <Section label="Older" items={groups.older} />
            </>
          )}
        </div>

        {/* User menu */}
        <div className="border-t border-[var(--dmoop-border-soft)] p-2 relative">
          {menuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-1.5 rounded-xl overflow-hidden dmoop-scale-in"
              style={{ background: "var(--dmoop-gradient-card)", boxShadow: "var(--dmoop-shadow-lg)", border: "1px solid var(--dmoop-border-soft)" }}>
              {isAdmin && (
                <>
                  <Link href="/admin" onClick={() => { setMenuOpen(false); onMobileClose(); }}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[var(--dmoop-text-primary)] hover:bg-[#faf6ef] transition-colors">
                    <Shield size={13} className="text-[var(--dmoop-accent)]" />
                    <span className="font-medium">Admin dashboard</span>
                  </Link>
                  <div className="h-px bg-[var(--dmoop-border-soft)] mx-2" />
                </>
              )}
              <Link href="/settings/integrations" onClick={() => { setMenuOpen(false); onMobileClose(); }}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[var(--dmoop-text-primary)] hover:bg-[#faf6ef] transition-colors">
                <Plug size={13} className="text-[var(--dmoop-accent)]" />
                <span className="font-medium">Integrations</span>
              </Link>
              <div className="h-px bg-[var(--dmoop-border-soft)] mx-2" />
              <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[var(--dmoop-text-primary)] hover:bg-[#faf6ef] transition-colors text-left">
                <LogOut size={13} className="text-[var(--dmoop-text-secondary)]" />
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          )}
          <button onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-2.5 py-2 transition-all duration-200",
              menuOpen ? "bg-white shadow-[var(--dmoop-shadow-sm)]" : "hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)]"
            )}>
            <div className="w-8 h-8 rounded-full text-white text-xs flex items-center justify-center font-semibold shrink-0"
              style={{ background: "var(--dmoop-gradient-accent)", boxShadow: "var(--dmoop-shadow-sm)" }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-semibold text-[var(--dmoop-text-primary)] truncate">{user?.name ?? "Loading…"}</p>
              <p className="text-[10.5px] text-[var(--dmoop-text-tertiary)] truncate">{user?.email}</p>
            </div>
            <ChevronUp size={13} className={cn("text-[var(--dmoop-text-secondary)] transition-transform duration-200", !menuOpen && "rotate-180")} />
          </button>
        </div>
      </aside>
    </>
  );
}
