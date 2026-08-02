/** App-side pairing-code format. Mirror of /protocol/pairingCode.ts (the app's
 *  tsconfig excludes `protocol/`, same reason `types.ts` is a mirror) — keep in
 *  sync. Minting is relay-only and deliberately absent here. */

/** Crockford base32: digits plus letters, less I, L, O and U. 8 characters
 *  carry 40 bits, which is what makes a cross-channel sweep of the pairing
 *  space unviable — see the note in /protocol/pairingCode.ts. */
export const PAIRING_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PAIRING_CODE_LENGTH = 8;

const CANONICAL = new RegExp(`^[${PAIRING_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`);
/** Codes minted before the 40-bit format — still valid channel locators for
 *  installs paired under the old scheme, so stored credentials keep resolving. */
const LEGACY = /^\d{6}$/;

/** Fold user input onto the alphabet: uppercase, resolve the characters
 *  Crockford drops because they are misread (I/l → 1, O → 0), discard the rest
 *  (spaces, the display dash, a stray U). */
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

/** Current format only — what the pair screen requires before it will submit. */
export function isPairingCode(code: string): boolean {
  return CANONICAL.test(code);
}

/** Anything that can legitimately name a pairing channel, including the legacy
 *  code an already-paired install may still hold in its stored credential. */
export function isChannelLocator(code: string): boolean {
  return CANONICAL.test(code) || LEGACY.test(code);
}

/** Display form — `K7M29XQP` reads as `K7M2-9XQP`. Never sent on the wire. */
export function formatPairingCode(code: string): string {
  return code.length === PAIRING_CODE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
