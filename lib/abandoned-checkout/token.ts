/**
 * #1733 — the restore-link token. 32 random bytes, base64url, sent only in the email; the database
 * keeps its SHA-256 (hex), so a leaked database row cannot be turned into a working link (R19).
 * Web Crypto only, so this runs unchanged on a Worker and in Node.
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashRecoveryToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function newRecoveryToken(): Promise<{ token: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = toBase64Url(bytes);
  return { token, hash: await hashRecoveryToken(token) };
}

/** A token's shape, checked before any lookup: 43 base64url characters. */
export function isWellFormedRecoveryToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
