// Room codes: 6 characters, uppercase, from an unambiguous alphabet.
// We drop the usual look-alikes so a code read aloud or squinted at across a
// couch is unambiguous: no O/0, no I/1, no S/5, no B/8, no Z/2.

const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY3467";
export const CODE_LENGTH = 6;

/** Generate a random 6-char room code using the crypto RNG when available. */
export function generateRoomCode(): string {
  const n = ALPHABET.length;
  let out = "";

  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    // Rejection-sample to avoid modulo bias against the alphabet length.
    const max = 256 - (256 % n);
    const buf = new Uint8Array(CODE_LENGTH * 2);
    while (out.length < CODE_LENGTH) {
      cryptoObj.getRandomValues(buf);
      for (let i = 0; i < buf.length && out.length < CODE_LENGTH; i++) {
        if (buf[i] < max) out += ALPHABET[buf[i] % n];
      }
    }
    return out;
  }

  // Fallback (very old runtimes): still fine for a personal-scale share code.
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * n)];
  }
  return out;
}

/** Normalize user-typed input toward a valid code (uppercase, strip non-alphabet). */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((ch) => ALPHABET.includes(ch))
    .join("")
    .slice(0, CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && normalizeCode(code) === code;
}
