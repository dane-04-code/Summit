import { decodeRelayCredential, encodeRelayCredential } from '@/agents/relay/credential';

describe('relay credentials', () => {
  it('round-trips a six-digit locator and strong private token', () => {
    const credential = { code: '481920', token: 't'.repeat(43) };
    expect(decodeRelayCredential(encodeRelayCredential(credential))).toEqual(credential);
  });

  it('rejects the legacy spent pairing code', () => {
    expect(() => decodeRelayCredential('481920')).toThrow(/paired again/i);
  });

  it('rejects short durable tokens', () => {
    expect(() => decodeRelayCredential(JSON.stringify({ code: '481920', token: 'short' })))
      .toThrow(/paired again/i);
  });
});
