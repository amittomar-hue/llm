-- ─────────────────────────────────────────────────────────────────
-- 0100_api_keys — public API key infrastructure for third-party
-- integrations. Users mint keys from /settings/api-keys and use
-- them as Bearer tokens against /api/v1/*.
--
-- Security model:
--   • The plaintext key (dmoop_live_...) is shown ONCE at creation,
--     then only its SHA-256 hash is stored. We cannot recover the
--     plaintext from the DB — same posture as Stripe, Anthropic,
--     OpenAI. Users must save it on generation or revoke + regen.
--   • The first 20 chars of the plaintext are stored as key_prefix
--     for display in the management UI ("dmoop_live_ab12cd34…").
--   • revoked_at is set on revoke; queries filter it out.
--   • last_used_at is updated best-effort on each successful auth so
--     users can spot stale keys.
--
-- RLS: locked to auth.uid() = user_id for owner reads/deletes.
-- Server-side inserts + verify use the service-role client which
-- bypasses RLS.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  key_hash      TEXT NOT NULL UNIQUE,   -- SHA-256 hex of plaintext, 64 chars
  key_prefix    TEXT NOT NULL,          -- display-only prefix, e.g. dmoop_live_xxxx
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Owner lookups (list / revoke UI).
CREATE INDEX IF NOT EXISTS api_keys_user_active_idx
  ON public.api_keys (user_id, created_at DESC)
  WHERE revoked_at IS NULL;

-- Hot path: verifying an incoming Bearer token against active keys.
-- Partial index so revoked rows don't clutter the lookup.
CREATE INDEX IF NOT EXISTS api_keys_hash_active_idx
  ON public.api_keys (key_hash)
  WHERE revoked_at IS NULL;

-- RLS: owners can see / delete their own keys. Server never reads
-- these through the anon client — the /api/v1/* handlers use the
-- service-role client which bypasses RLS.
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_keys_owner_select ON public.api_keys;
CREATE POLICY api_keys_owner_select ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS api_keys_owner_delete ON public.api_keys;
CREATE POLICY api_keys_owner_delete ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Deliberately no INSERT / UPDATE policies — those go through the
-- server route which uses the service-role client and enforces its
-- own ownership checks.

-- Convenience view: what the management UI needs (never exposes
-- key_hash or plaintext).
CREATE OR REPLACE VIEW public.v_api_keys_public AS
SELECT
  id,
  user_id,
  name,
  key_prefix,
  last_used_at,
  revoked_at,
  created_at
FROM public.api_keys;
GRANT SELECT ON public.v_api_keys_public TO anon, authenticated;
