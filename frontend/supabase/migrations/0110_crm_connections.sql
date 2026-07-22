-- ─────────────────────────────────────────────────────────────────
-- 0110_crm_connections — per-user CRM OAuth token store.
--
-- Design:
--   • One row per (user_id, provider). Reconnecting the same CRM
--     UPSERTs the existing row rather than accumulating stale tokens.
--   • access_token and refresh_token are stored as base64-encoded
--     AES-256-GCM ciphertext. The IV + auth tag are packed with the
--     ciphertext so a single string round-trips through the DB. The
--     key lives in CRM_TOKEN_ENCRYPTION_KEY (32 bytes, base64).
--   • expires_at is the wall-clock time the access token becomes
--     invalid. Refresh 60s before this to avoid mid-request expiry.
--   • provider is TEXT (not enum) so adding Salesforce / Pipedrive /
--     Zoho later just means a new row, no migration.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crm_connections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL CHECK (provider IN ('hubspot', 'salesforce', 'pipedrive', 'zoho')),
  portal_id            TEXT,                        -- provider-side account identifier (HubSpot: hub_id)
  access_token         TEXT NOT NULL,               -- AES-GCM ciphertext, base64
  refresh_token        TEXT NOT NULL,               -- AES-GCM ciphertext, base64
  expires_at           TIMESTAMPTZ NOT NULL,
  scopes               TEXT[] DEFAULT '{}',
  connected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at    TIMESTAMPTZ,
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS crm_connections_user_provider_idx
  ON public.crm_connections (user_id, provider);

-- RLS: owners can see (and delete) their own connections. Server
-- routes use the service-role client to insert/update, bypassing RLS
-- because the OAuth callback happens under a session that we then
-- resolve to a user_id explicitly.
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_connections_owner_select ON public.crm_connections;
CREATE POLICY crm_connections_owner_select ON public.crm_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS crm_connections_owner_delete ON public.crm_connections;
CREATE POLICY crm_connections_owner_delete ON public.crm_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Non-sensitive display view for the /settings/integrations UI —
-- never exposes ciphertext. All the management page needs is
-- "which provider, when connected, when the token expires, scopes."
CREATE OR REPLACE VIEW public.v_crm_connections_public AS
SELECT
  id,
  user_id,
  provider,
  portal_id,
  expires_at,
  scopes,
  connected_at,
  last_refreshed_at
FROM public.crm_connections;

GRANT SELECT ON public.v_crm_connections_public TO anon, authenticated;
