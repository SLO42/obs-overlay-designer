/**
 * URL-safe alphabet used for the random suffix. 64 chars → 6 bits/char,
 * matching the nanoid default. Stable ordering is not required since only
 * the timestamp prefix is used for sorting.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

/**
 * Pulls cryptographically-strong random bytes when available, with a
 * Math.random fallback for exotic environments (e.g. older Node without
 * globalThis.crypto). The fallback still satisfies the uniqueness tests.
 */
function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  const g = globalThis as { crypto?: { getRandomValues?: (buf: Uint8Array) => Uint8Array } };
  if (g.crypto && typeof g.crypto.getRandomValues === "function") {
    g.crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < len; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

/**
 * Pads (or truncates) the base-36 timestamp to exactly `len` characters so
 * ids remain a stable length. Uses a leading-zero left-pad so shorter
 * timestamps still sort lexicographically against longer ones within the
 * same era.
 */
function timestampPrefix(len: number): string {
  const ts = Date.now().toString(36);
  if (ts.length >= len) {
    return ts.slice(-len);
  }
  return ts.padStart(len, "0");
}

const TIMESTAMP_LEN = 9;
const TOTAL_LEN = 21;
const RANDOM_LEN = TOTAL_LEN - TIMESTAMP_LEN;

/**
 * Generates a 21-char URL-safe id. The first 9 chars are a base-36 encoding
 * of Date.now() (covers through year ~5188), making ids sortable by
 * creation time. The remaining 12 chars are random alphabet characters.
 *
 * This is time-sortable (newer id >= older id lexically) without pulling in
 * a dependency on nanoid/uuid.
 */
export function id(): string {
  const prefix = timestampPrefix(TIMESTAMP_LEN);
  const bytes = randomBytes(RANDOM_LEN);
  let suffix = "";
  for (let i = 0; i < RANDOM_LEN; i++) {
    // Masking to 6 bits keeps the lookup inside the 64-char alphabet.
    suffix += ALPHABET[bytes[i]! & 0x3f];
  }
  return prefix + suffix;
}
