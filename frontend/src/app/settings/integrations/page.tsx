"use client";

// ─────────────────────────────────────────────────────────────────
// /settings/integrations — CRM + tool connections.
//
// MVP scope: HubSpot only. The card list is designed so Salesforce,
// Pipedrive, and Zoho slot in as additional entries without a rebuild.
//
// Flow:
//   Connect → redirect to /api/settings/integrations/hubspot/connect
//              → HubSpot auth screen → callback → back here with
//              ?hubspot=connected (or an error status).
//   Disconnect → DELETE /api/settings/integrations?provider=hubspot
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plug, Check, AlertTriangle, Loader2, ShieldCheck, Trash2,
} from "lucide-react";

interface Connection {
  id: string;
  provider: string;
  portal_id: string | null;
  scopes: string[];
  connected_at: string;
  expires_at: string;
  last_refreshed_at: string | null;
}

interface ProviderDef {
  id: "hubspot" | "salesforce" | "pipedrive" | "zoho";
  name: string;
  tagline: string;
  connect_href: string;
  brand_color: string;
  enabled: boolean;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "hubspot",
    name: "HubSpot",
    tagline: "Ground emails and messages in the recipient's contact record, deal stage, and company context.",
    connect_href: "/api/settings/integrations/hubspot/connect",
    brand_color: "#ff7a59",
    enabled: true,
  },
  {
    id: "zoho",
    name: "Zoho CRM",
    tagline: "Pull real contact, account, and deal context from Zoho into every generated message.",
    connect_href: "/api/settings/integrations/zoho/connect",
    brand_color: "#e42527",
    enabled: true,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    tagline: "Coming soon.",
    connect_href: "",
    brand_color: "#00a1e0",
    enabled: false,
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    tagline: "Coming soon.",
    connect_href: "",
    brand_color: "#1a1a1a",
    enabled: false,
  },
];

function friendlyStatus(
  provider: string,
  status: string | null,
  reason: string | null
): { kind: "ok" | "err" | null; msg: string } {
  if (!status) return { kind: null, msg: "" };
  const providerName = provider === "hubspot" ? "HubSpot" : provider === "zoho" ? "Zoho CRM" : provider;
  if (status === "connected") {
    return { kind: "ok", msg: `${providerName} connected. Emails and messages will now use CRM context.` };
  }
  const map: Record<string, string> = {
    denied_access_denied: `You denied the ${providerName} authorization request.`,
    invalid_state: "The OAuth state token was invalid or expired. Try again.",
    session_mismatch: "Your session changed mid-flow. Sign in and reconnect.",
    exchange_failed: `${providerName} rejected the authorization code.`,
    missing_params: `${providerName} didn't return an authorization code.`,
    server_misconfigured: `The server is missing ${providerName} credentials. Contact support.`,
    hubspot_config_missing: "HubSpot integration is not configured on this deployment.",
    zoho_config_missing: "Zoho integration is not configured on this deployment.",
    missing_pkce_cookie: "Your OAuth session expired or the PKCE cookie was blocked. Try again — don't use incognito or third-party-cookie-blocking browsers.",
  };
  const base = map[status] ?? `Connection failed: ${status}`;
  return { kind: "err", msg: reason ? `${base} Details: ${reason}` : base };
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--reverb-bg-app)" }} />}>
      <IntegrationsPageInner />
    </Suspense>
  );
}

function IntegrationsPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  // Whichever provider set its status wins the banner. Only one should
  // ever be present at a time (each callback writes to its own key).
  const hubspotStatus = params.get("hubspot");
  const zohoStatus = params.get("zoho");
  const reason = params.get("reason");
  const [activeProvider, activeStatus] = hubspotStatus
    ? ["hubspot", hubspotStatus]
    : zohoStatus
    ? ["zoho", zohoStatus]
    : ["", null];
  const banner = friendlyStatus(activeProvider, activeStatus, reason);

  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/integrations");
      const j = await res.json();
      if (res.ok) {
        setConnections(j.connections ?? []);
      } else if (j.error === "migration_not_applied") {
        // Swallow silently — DB isn't provisioned yet is an admin-side
        // concern, not something end users should see. The page still
        // renders the provider cards so users can click Connect once
        // ops has run the migration.
        setConnections([]);
      } else {
        const detail = typeof j.detail === "string" ? ` — ${j.detail}` : "";
        setError(`${j.error ?? "Failed to load connections"}${detail}`);
      }
    } catch {
      setError("Network error while loading connections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const disconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${provider}? Reverb will stop pulling CRM context from this provider immediately.`)) return;
    setBusyProvider(provider);
    try {
      const res = await fetch(`/api/settings/integrations?provider=${provider}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Disconnect failed");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusyProvider(null);
    }
  };

  const dismissBanner = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("hubspot");
    url.searchParams.delete("zoho");
    url.searchParams.delete("reason");
    router.replace(url.pathname + (url.search ? url.search : ""));
  };

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const findConn = (id: string) => connections?.find((c) => c.provider === id);

  return (
    <div className="min-h-screen" style={{ background: "var(--reverb-bg-app)" }}>
      <nav className="sticky top-0 z-30 border-b border-[var(--reverb-border-soft)] backdrop-blur-xl bg-white/70">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/chat" className="flex items-center gap-2 text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
            <ArrowLeft size={13} /> Back to chat
          </Link>
          <span className="font-semibold tracking-tight text-[var(--reverb-accent)] text-lg">Reverb</span>
          <Link href="/settings/api-keys" className="text-[12.5px] sm:text-[13px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)]">
            API keys
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-start gap-3 mb-6 sm:mb-8">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
            <Plug size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--reverb-accent)] uppercase mb-1">
              Settings
            </p>
            <h1 className="text-[24px] sm:text-[30px] font-semibold tracking-tight text-[var(--reverb-text-primary)] leading-tight mb-1">
              Integrations
            </h1>
            <p className="text-[13px] sm:text-[14px] text-[var(--reverb-text-secondary)]">
              Connect Reverb to your CRM so generated emails and messages are grounded in real contact history, deal stage, and company context.
            </p>
          </div>
        </div>

        {banner.kind && (
          <div className={
            "rounded-2xl border p-4 mb-5 flex items-start gap-2.5 " +
            (banner.kind === "ok"
              ? "border-emerald-300 bg-emerald-50"
              : "border-amber-300 bg-amber-50")
          }>
            {banner.kind === "ok" ? (
              <Check size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={"text-[13px] font-medium " + (banner.kind === "ok" ? "text-emerald-900" : "text-amber-900")}>
                {banner.msg}
              </p>
            </div>
            <button
              onClick={dismissBanner}
              className={"text-[12px] font-medium underline underline-offset-2 shrink-0 " + (banner.kind === "ok" ? "text-emerald-800" : "text-amber-900")}
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 mb-5 flex items-start gap-2 text-[12.5px] text-red-700">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* If the last Connect attempt failed because the DB table is missing,
            surface the SQL block. Detected via the reason substring HubSpot
            returned. Only shows after a real failed attempt. */}
        {banner.kind === "err" && reason && /crm_connections|schema cache|does not exist/i.test(reason) && (
          <details className="rounded-2xl border border-amber-300 bg-amber-50 p-4 mb-5 group" open>
            <summary className="cursor-pointer text-[13px] font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle size={14} /> Setup step needed — click for details
            </summary>
            <p className="text-[12.5px] text-amber-800 mt-2 mb-3">
              Your Supabase project is missing the <code className="text-[11px] bg-amber-100 px-1 rounded">crm_connections</code> table.
              Open <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-medium">supabase.com/dashboard</a> → your project → <strong>SQL Editor</strong> → <strong>New query</strong>. Paste the SQL below, click <strong>Run</strong>, then click Connect again.
            </p>
            <pre className="text-[11px] leading-relaxed bg-white border border-amber-200 rounded-lg p-3 overflow-x-auto font-mono text-amber-950">{`CREATE TABLE IF NOT EXISTS public.crm_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL CHECK (provider IN ('hubspot','salesforce','pipedrive','zoho')),
  portal_id         TEXT,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  scopes            TEXT[] DEFAULT '{}',
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ,
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS crm_connections_user_provider_idx
  ON public.crm_connections (user_id, provider);
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_connections_owner_select ON public.crm_connections;
CREATE POLICY crm_connections_owner_select ON public.crm_connections
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS crm_connections_owner_delete ON public.crm_connections;
CREATE POLICY crm_connections_owner_delete ON public.crm_connections
  FOR DELETE USING (auth.uid() = user_id);`}</pre>
          </details>
        )}

        <div className="space-y-3 mb-6">
          {loading && !connections && (
            <div className="rounded-2xl border border-[var(--reverb-border-soft)] bg-white/60 px-4 py-6 text-center">
              <Loader2 size={16} className="animate-spin mx-auto text-[var(--reverb-text-tertiary)]" />
            </div>
          )}

          {PROVIDERS.map((p) => {
            const conn = findConn(p.id);
            const isConnected = Boolean(conn);
            return (
              <div key={p.id} className="rounded-2xl overflow-hidden"
                style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
                <div className="px-4 sm:px-5 py-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-[15px]"
                    style={{ background: p.brand_color }}>
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[14.5px] font-semibold text-[var(--reverb-text-primary)]">{p.name}</p>
                      {isConnected && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                          <Check size={9} strokeWidth={3} /> Connected
                        </span>
                      )}
                      {!p.enabled && (
                        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] bg-[#f2ede4] px-1.5 py-0.5 rounded">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-[var(--reverb-text-secondary)] leading-snug">{p.tagline}</p>
                    {isConnected && conn && (
                      <p className="text-[11px] text-[var(--reverb-text-tertiary)] mt-1.5">
                        Connected {fmt(conn.connected_at)}
                        {conn.portal_id ? `  ·  Portal ${conn.portal_id}` : ""}
                        {"  ·  "}Scopes: {conn.scopes.length}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {isConnected ? (
                      <button
                        onClick={() => void disconnect(p.id)}
                        disabled={busyProvider === p.id}
                        className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-red-700 hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-40"
                      >
                        {busyProvider === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Disconnect
                      </button>
                    ) : p.enabled ? (
                      <a
                        href={p.connect_href}
                        className="h-9 px-4 rounded-lg reverb-btn-primary text-[12.5px] font-semibold inline-flex items-center gap-1.5"
                      >
                        Connect
                      </a>
                    ) : (
                      <button
                        disabled
                        className="h-9 px-4 rounded-lg text-[12.5px] font-semibold bg-[#f2ede4] text-[var(--reverb-text-tertiary)] cursor-not-allowed"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl p-4 sm:p-5 bg-[#fbf8f4] border border-[var(--reverb-border-soft)]">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-[12.5px] text-[var(--reverb-text-secondary)] leading-relaxed">
              <strong className="text-[var(--reverb-text-primary)]">How CRM grounding works:</strong>{" "}
              When you mention a recipient by email in a prompt (e.g. <em>&quot;write a nurture email for alice@acme.com&quot;</em>),
              Reverb looks up that contact in your connected CRM and injects their name, role, company, deal stage, and lifecycle stage into the
              generation context alongside your brand agent. Tokens are encrypted at rest and only ever read to service your own account.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
