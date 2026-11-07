// Visitor identity for the festival: a nickname + a recovery ID.
//
// Faiq's decision (voice, 2026-11-07): no account, no email, no password,
// no eID, nothing personal. On first visit the site asks for a nickname
// (display-only — not unique, not a secret) and generates a random numeric
// recovery ID of exactly 10 digits, never derived from the nickname. The
// ID is the key / bearer token: it is sent as the `x-visitor-id` header on
// festival API calls and keys the server-side per-visitor state
// (`loy:events:<recovery-id>`, later `api/state` in E1). It is stored in
// the visitor's own browser (localStorage) so the same device just works;
// on another device the visitor types the ID back in to restore.
//
// The ID is generated with a cryptographic random source
// (crypto.getRandomValues); the first digit is 1–9 so the ID is always
// exactly 10 digits long, never 9 with a leading zero.

export interface VisitorIdentity {
  nickname: string;
  id: string; // exactly 10 digits
}

const IDENTITY_KEY = 'loy:identity';

export const RECOVERY_ID_LENGTH = 10;
export const RECOVERY_ID_PATTERN = /^\d{10}$/;
export const MAX_NICKNAME_CHARS = 40;

/** True when the value is a well-formed recovery ID (exactly 10 digits). */
export function isValidRecoveryId(value: unknown): value is string {
  return typeof value === 'string' && RECOVERY_ID_PATTERN.test(value);
}

/** A nickname is 1–40 non-blank characters. Display-only, never a secret. */
export function isValidNickname(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= MAX_NICKNAME_CHARS;
}

/**
 * Generate a random 10-digit recovery ID. First digit 1–9, the rest 0–9,
 * drawn from crypto.getRandomValues. Throws when no cryptographic random
 * source is available rather than falling back to Math.random.
 */
export function generateRecoveryId(): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('no_secure_random');
  }
  const bytes = new Uint8Array(RECOVERY_ID_LENGTH);
  cryptoObj.getRandomValues(bytes);
  let id = String(1 + (bytes[0] % 9)); // first digit 1–9
  for (let i = 1; i < RECOVERY_ID_LENGTH; i++) id += String(bytes[i] % 10);
  return id;
}

function parseIdentity(raw: unknown): VisitorIdentity | null {
  if (!raw || typeof raw !== 'object') return null;
  const { nickname, id } = raw as Record<string, unknown>;
  if (!isValidNickname(nickname) || !isValidRecoveryId(id)) return null;
  return { nickname: (nickname as string).trim(), id: id as string };
}

/** The stored identity, or null when this browser has none (SSR-safe). */
export function getIdentity(): VisitorIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseIdentity(JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

/** The recovery ID (the `x-visitor-id` bearer token), or null. */
export function getVisitorId(): string | null {
  return getIdentity()?.id ?? null;
}

/**
 * Store an identity in this browser. Returns false (and stores nothing)
 * when the nickname or ID is malformed — callers validate first and show
 * their own message; this is the last line of defence.
 */
export function saveIdentity(identity: VisitorIdentity): boolean {
  const parsed = parseIdentity(identity);
  if (!parsed || typeof window === 'undefined') return false;
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a fresh identity for a nickname: generate a random recovery ID
 * and store both. Returns null when the nickname is invalid or storage
 * (or a secure random source) is unavailable.
 */
export function createIdentity(nickname: string): VisitorIdentity | null {
  if (!isValidNickname(nickname)) return null;
  let id: string;
  try {
    id = generateRecoveryId();
  } catch {
    return null;
  }
  const identity = { nickname: nickname.trim(), id };
  return saveIdentity(identity) ? identity : null;
}

/**
 * Restore an identity the visitor typed back in (nickname + 10-digit ID).
 * Validates the ID format; returns null (storing nothing) when malformed.
 * This only stores the ID locally for D1 — pulling the visitor's progress
 * back from the server is E1's job, not this function's.
 */
export function restoreIdentity(nickname: string, id: string): VisitorIdentity | null {
  if (!isValidNickname(nickname) || !isValidRecoveryId(id)) return null;
  const identity = { nickname: nickname.trim(), id };
  return saveIdentity(identity) ? identity : null;
}
