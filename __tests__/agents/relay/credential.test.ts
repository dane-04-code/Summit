import { decodeRelayCredential, encodeRelayCredential } from '@/agents/relay/credential';

describe('relay credentials', () => {
  it('round-trips a channel locator and strong private token', () => {
    const credential = { code: 'K7M29XQP', token: 't'.repeat(43) };
    expect(decodeRelayCredential(encodeRelayCredential(credential))).toEqual(credential);
  });

  it('still resolves a six-digit locator so installs paired before the format change keep working', () => {
    const credential = { code: '481920', token: 't'.repeat(43) };
    expect(decodeRelayCredential(encodeRelayCredential(credential))).toEqual(credential);
  });

  it('rejects a locator that could not name a channel', () => {
    expect(() => decodeRelayCredential(JSON.stringify({ code: 'K7M2', token: 't'.repeat(43) })))
      .toThrow(/paired again/i);
  });

  it('rejects the legacy spent pairing code', () => {
    expect(() => decodeRelayCredential('481920')).toThrow(/paired again/i);
  });

  it('rejects short durable tokens', () => {
    expect(() => decodeRelayCredential(JSON.stringify({ code: '481920', token: 'short' })))
      .toThrow(/paired again/i);
  });
});
