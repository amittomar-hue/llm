// ─────────────────────────────────────────────────────────────────
// CRM OAuth token encryption at rest.
//
// OAuth access + refresh tokens grant DMOOP the ability to read a
// user's HubSpot/Salesforce/etc. data. A DB leak that also leaks
// these tokens = attacker gets read access to every connected CRM.
// So we encrypt symmetrically at rest with AES-256-GCM.
//
// Format on the wire (single base64 string):
//   [12-byte IV][16-byte auth tag][ciphertext...]
//
// The key lives in CRM_TOKEN_ENCRYPTION_KEY (32-byte base64). Rotate
// by adding a versioned prefix later; for now MVP is single-key.
// ─────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;    // GCM standard
const TAG_LEN = 16;   // GCM standard

function getKey(): Buffer {
  const raw = process.env.CRM_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "CRM_TOKEN_ENCRYPTION_KEY env var missing. Generate with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CRM_TOKEN_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}`
    );
  }
  return key;
}

/** Encrypt a plaintext token. Output is url-safe-base64 (no padding). */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64url");
}

/**
 * Decrypt a token previously produced by encryptToken. Throws on any
 * tampering (GCM auth tag verifies integrity). Callers should treat
 * a throw as "connection is invalid — force user to reconnect."
 */
export function decryptToken(packed: string): string {
  const buf = Buffer.from(packed, "base64url");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("ciphertext too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const key = getKey();
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
