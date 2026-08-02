/**
 * Pairing-code format.
 *
 * The code is the short-lived, single-use *transfer mechanism* for the durable
 * session token — never a long-lived credential itself. Its only security job
 * is to stay unguessable for the length of one pairing window.
 *
 * That job is done by entropy, not by the lockout. The per-code lockout in
 * `logic.ts` lives in per-code Durable Object state, so it only ever sees one
 * code being hammered; an attacker spreading a few guesses each across many
 * codes never trips it. Against a 6-digit code that left ~900k channels open to
 * a sweep. The alphabet below is Crockford base32 (no I, L, O, U), so 8
 * characters carry 40 bits ≈ 1.1e12 codes and the sweep stops being viable.
 *
 * Mirrored in `src/agents/relay/pairingCode.ts` (app, which cannot import from
 * `protocol/` — see tsconfig `exclude`) and `connector/pairing.go`. Keep all
 * three in sync; each has a test pinning the alphabet so drift is caught.
 */

/** Crockford base32: digits plus letters, less I, L, O and U. */
export const PAIRING_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PAIRING_CODE_LENGTH = 8;

// Built from the alphabet rather than hand-written so the two can never drift.
// The alphabet contains no regex metacharacters, so it is safe inside a class.
const CANONICAL = new RegExp(`^[${PAIRING_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`);

/** Codes minted before the 40-bit format. Never issued anymore, but still
 *  honoured as channel locators so installs paired under the old scheme — and
 *  connectors that saved one — keep working without re-pairing. */
const LEGACY = /^\d{6}$/;

/**
 * Fold user input onto the canonical alphabet: uppercase, resolve the
 * characters Crockford drops because they are misread (I/l → 1, O → 0), and
 * discard anything left over (spaces, the display dash, a stray U).
 */
export function normalizePairingCode(input: string): string {
  const folded = input.toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0');
  let out = '';
  for (const ch of folded) {
    if (!PAIRING_ALPHABET.includes(ch)) continue;
    out += ch;
    if (out.length === PAIRING_CODE_LENGTH) break;
  }
  return out;
}

/** True for the current format only — what the app requires before it will
 *  send a `pair` frame. Legacy codes are no longer mintable, so a user typing
 *  one today is typing something stale. */
export function isPairingCode(code: string): boolean {
  return CANONICAL.test(code);
}

/** True for anything that can legitimately name a pairing channel: a current
 *  code, or a legacy one still held by an already-paired install. */
export function isChannelLocator(code: string): boolean {
  return CANONICAL.test(code) || LEGACY.test(code);
}

/** Display form — `K7M29XQP` reads as `K7M2-9XQP`. Never sent on the wire. */
export function formatPairingCode(code: string): string {
  return code.length === PAIRING_CODE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/**
 * A fresh code. 32 divides 256, so masking a random byte to its low 5 bits is
 * uniform over the alphabet with no rejection loop — unlike `random % 900000`,
 * which is biased because 900000 does not divide 2^32 and quietly costs real
 * keyspace. Crypto-grade source only: `Math.random` is predictable and must
 * never gate access.
 */
export function mintPairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PAIRING_CODE_LENGTH));
  let code = '';
  for (const byte of bytes) code += PAIRING_ALPHABET[byte & 31];
  return code;
}
