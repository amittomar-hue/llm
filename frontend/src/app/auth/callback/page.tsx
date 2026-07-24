"use client";

// ─────────────────────────────────────────────────────────────────
// /auth/callback — handles BOTH email-verification flows Supabase
// can emit. The previous version was a server-side route handler
// that only understood the PKCE flow (?code=); when Supabase landed
// users with the legacy hash flow (#access_token=…) the server
// couldn't see the hash and we fell through to /signin, leaving
// freshly-verified users on the home page wondering why they
// weren't logged in.
//
// This client component runs on the browser, so it sees the URL hash
// fragment AND can call supabase.auth.exchangeCodeForSession for
// PKCE. After successful session setup it router.push("/chat") so
// users land directly on chat post-verification.
//
// Why client over server: the only reliable cross-flow handler is
// the browser — server can't read the hash, and Supabase decides
// per-project which flow to use. Better to support both than to
// gamble on which one a given verification link will carry.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = createSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      // PKCE flow — Supabase put a ?code= in the query string. We
      // exchange that code for a session via the browser client; the
      // @supabase/ssr cookies helpers persist the session cookies
      // automatically so middleware sees the user on the next nav.
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          // Give the user a beat to see the error before bouncing.
          setTimeout(() => router.replace("/signin"), 1500);
          return;
        }
        router.replace("/chat");
        return;
      }

      // Hash flow — Supabase put tokens in window.location.hash like
      // #access_token=...&refresh_token=...&type=signup. The browser
      // client's detectSessionInUrl behavior automatically parses the
      // hash on init, but we call getSession() to wait for that work
      // to finish and confirm the session landed before navigating.
      const hasHashTokens = window.location.hash.includes("access_token");
      if (hasHashTokens) {
        // Give the SDK a moment to parse the hash and persist cookies.
        // 100ms is conservative; in practice it's done synchronously
        // during the createBrowserClient call above, but a tick lets
        // any pending cookie writes settle before we navigate.
        await new Promise((r) => setTimeout(r, 100));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Strip the hash so the next nav doesn't carry leftover tokens.
          window.history.replaceState(null, "", "/auth/callback");
          router.replace("/chat");
          return;
        }
      }

      // Neither flow had usable tokens — verification link was malformed,
      // already used, or expired. Send to signin with a soft error param.
      setError("Verification link was missing or expired.");
      setTimeout(() => router.replace("/signin?verify=expired"), 1500);
    };

    void run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--reverb-bg-app)" }}>
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-2 border-[var(--reverb-accent)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[14px] font-medium text-[var(--reverb-text-primary)]">
          {error ? "Verification failed" : "Finishing sign-in…"}
        </p>
        {error && (
          <p className="text-[12.5px] text-[var(--reverb-text-tertiary)] mt-1.5 max-w-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
