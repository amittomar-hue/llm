// ─────────────────────────────────────────────────────────────────
// API key helpers — generation, hashing, and Bearer-token
// verification for Reverb's public /api/v1/* surface.
//
// Format: `reverb_live_<40-char base64url secret>`
//   • ~30 bytes of crypto randomness → 40 char URL-safe encoding
//   • "live" prefix reserved for future "test" mode if we ever add it
//   • Hashed with SHA-256 before persistence (irreversible)
//   • First 20 chars shown in the UI as `key_prefix` for identification
//
// The plaintext is returned to the user ONE TIME on creation and
// never again — same posture as Stripe / Anthropic / OpenAI.
// ─────────────────────────────────────────────────────────────────

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabase } from "./supabase";

const KEY_PREFIX = "reverb_live_";
const PLAINTEXT_LENGTH = KEY_PREFIX.length + 40; // 11 + 40 = 51 chars

export interface GeneratedApiKey {
  /** The raw key — return to user once, never persist plaintext. */
  plaintext: string;
  /** SHA-256 hex digest of plaintext, stored in the DB. */
  hash: string;
  /** First 20 chars of plaintext, stored for identification in the UI. */
  prefix: string;
}

/**
 * Mint a fresh API key. Only the returned `plaintext` field is user-facing;
 * store `hash` in the DB and `prefix` for display.
 */
export function generateApiKey(): GeneratedApiKey {
  // 30 bytes → 40-char base64url string with no padding.
  const secret = randomBytes(30).toString("base64url");
  const plaintext = `${KEY_PREFIX}${secret}`;
  const hash = sha256(plaintext);
  const prefix = plaintext.slice(0, 20); // "reverb_live_" + 9 secret chars
  return { plaintext, hash, prefix };
}

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Constant-time comparison of two SHA-256 hex digests. Standard equality
 * (`===`) leaks length + first-differing-byte via timing — with hashes
 * that's rarely exploitable in practice, but the cost of doing it right
 * is zero.
 */
export function safeEqualHashes(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface ApiKeyLookup {
  keyId: string;
  userId: string;
}

/**
 * Verify an incoming Bearer token. Returns { keyId, userId } if the key
 * matches an active row in api_keys, else null. Best-effort updates
 * last_used_at on hit — the update is fire-and-forget so verification
 * latency isn't held up waiting on a write.
 */
export async function verifyApiKey(rawKey: string | null | undefined): Promise<ApiKeyLookup | null> {
  if (!rawKey) return null;
  const trimmed = rawKey.trim();
  if (!trimmed.startsWith(KEY_PREFIX)) return null;
  if (trimmed.length !== PLAINTEXT_LENGTH) return null;

  const service = getSupabase();
  if (!service) return null;

  const hash = sha256(trimmed);

  const { data: row } = await service
    .from("api_keys")
    .select("id, user_id, revoked_at, key_hash")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!row) return null;
  // Belt-and-suspenders: the eq() already filtered on hash, but the
  // constant-time compare guards against any exotic DB-layer quirks.
  if (!safeEqualHashes(row.key_hash as string, hash)) return null;

  // Fire-and-forget last-used bump; don't block verification on it.
  void service
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    keyId: row.id as string,
    userId: row.user_id as string,
  };
}

/**
 * Extract a Bearer token from an Authorization header, tolerating
 * common formatting quirks (extra whitespace, case-insensitive scheme).
 * Returns null if absent or malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^\s*Bearer\s+(.+?)\s*$/i);
  return match ? match[1] : null;
}
