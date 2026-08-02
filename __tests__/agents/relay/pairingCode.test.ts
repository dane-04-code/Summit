import {
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  formatPairingCode,
  isChannelLocator,
  isPairingCode,
  normalizePairingCode,
} from '@/agents/relay/pairingCode';

describe('pairing code format', () => {
  it('pins the alphabet and length the relay and connector also hard-code', () => {
    // This file is one of three mirrors (see /protocol/pairingCode.ts and
    // connector/pairing.go). If this fails, the others have drifted and codes
    // minted by the relay will not validate on the device.
    expect(PAIRING_ALPHABET).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ');
    expect(PAIRING_CODE_LENGTH).toBe(8);
  });

  it('omits the characters that are misread when transcribed', () => {
    for (const ambiguous of ['I', 'L', 'O', 'U']) {
      expect(PAIRING_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('carries enough entropy that sweeping the code space is not viable', () => {
    // 32^8 = 2^40. The per-code lockout can only ever see one channel, so this
    // number — not the lockout — is what stops a distributed sweep.
    expect(PAIRING_ALPHABET.length ** PAIRING_CODE_LENGTH).toBeGreaterThan(1e12);
  });
});

describe('normalizePairingCode', () => {
  it('folds case, the display dash, and misread characters', () => {
    expect(normalizePairingCode('k7m2-9xqp')).toBe('K7M29XQP');
    expect(normalizePairingCode('  k7m2 9xqp  ')).toBe('K7M29XQP');
    // I and L both read as 1, O reads as 0 — Crockford's whole point.
    expect(normalizePairingCode('IL0ABCDE')).toBe('110ABCDE');
    expect(normalizePairingCode('k7m2o9xq')).toBe('K7M209XQ');
  });

  it('drops characters outside the alphabet rather than passing them through', () => {
    // U is excluded from the alphabet, so it can never appear in a real code.
    expect(normalizePairingCode('K7M2U9XQP')).toBe('K7M29XQP');
    expect(normalizePairingCode('K7M2/9XQ!P')).toBe('K7M29XQP');
  });

  it('caps at the code length so a pasted paragraph cannot overflow the field', () => {
    expect(normalizePairingCode('K7M29XQPZZZZZZZZ')).toHaveLength(8);
  });
});

describe('isPairingCode', () => {
  it('accepts a canonical code', () => {
    expect(isPairingCode('K7M29XQP')).toBe(true);
  });

  it('rejects a legacy six-digit code — those can no longer be minted', () => {
    expect(isPairingCode('481920')).toBe(false);
  });

  it('rejects short, long, and out-of-alphabet input', () => {
    expect(isPairingCode('K7M29XQ')).toBe(false);
    expect(isPairingCode('K7M29XQPZ')).toBe(false);
    expect(isPairingCode('K7M29XQU')).toBe(false);
    expect(isPairingCode('k7m29xqp')).toBe(false);
  });
});

describe('isChannelLocator', () => {
  it('still resolves legacy locators so paired installs keep working', () => {
    expect(isChannelLocator('481920')).toBe(true);
    expect(isChannelLocator('K7M29XQP')).toBe(true);
  });

  it('rejects anything that could not name a channel', () => {
    expect(isChannelLocator('')).toBe(false);
    expect(isChannelLocator('48192')).toBe(false);
    expect(isChannelLocator('../../etc/passwd')).toBe(false);
  });
});

describe('formatPairingCode', () => {
  it('groups a canonical code and leaves anything else alone', () => {
    expect(formatPairingCode('K7M29XQP')).toBe('K7M2-9XQP');
    expect(formatPairingCode('K7M2')).toBe('K7M2');
    expect(formatPairingCode('481920')).toBe('481920');
  });
});
