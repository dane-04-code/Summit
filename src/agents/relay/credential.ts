export type RelayCredential = { code: string; token: string };

export function encodeRelayCredential(credential: RelayCredential): string {
  return JSON.stringify(credential);
}

export function decodeRelayCredential(value: string): RelayCredential {
  try {
    const parsed = JSON.parse(value) as Partial<RelayCredential>;
    if (
      typeof parsed.code === 'string' && /^\d{6}$/.test(parsed.code) &&
      typeof parsed.token === 'string' && parsed.token.length >= 43
    ) {
      return { code: parsed.code, token: parsed.token };
    }
  } catch {
    // Legacy installs stored only the spent pairing code and must pair again.
  }
  throw new Error('This relay connection needs to be paired again.');
}
