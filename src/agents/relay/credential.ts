import { isChannelLocator } from './pairingCode';

export type RelayCredential = { code: string; token: string };

export function encodeRelayCredential(credential: RelayCredential): string {
  return JSON.stringify(credential);
}

export function decodeRelayCredential(value: string): RelayCredential {
  try {
    const parsed = JSON.parse(value) as Partial<RelayCredential>;
    if (
      // Legacy 6-digit locators still resolve: the code here is a spent channel
      // name, not a credential, and installs paired before the format changed
      // must not be forced to pair again.
      typeof parsed.code === 'string' && isChannelLocator(parsed.code) &&
      typeof parsed.token === 'string' && parsed.token.length >= 43
    ) {
      return { code: parsed.code, token: parsed.token };
    }
  } catch {
    // Legacy installs stored only the spent pairing code and must pair again.
  }
  throw new Error('This relay connection needs to be paired again.');
}
