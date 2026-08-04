import { describe, expect, it } from 'vitest';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/channel-core';
import { DEFAULT_RELAY_URL, inspectAccount, resolveAccount } from './config';

const cfg = (summit?: Record<string, unknown>): OpenClawConfig =>
  ({ channels: summit ? { summit } : {} }) as unknown as OpenClawConfig;

describe('resolveAccount', () => {
  it('is enabled with the hosted relay when nothing is configured', () => {
    const account = resolveAccount(cfg());
    expect(account.enabled).toBe(true);
    expect(account.relayUrl).toBe(DEFAULT_RELAY_URL);
    expect(account.agentName).toBeUndefined();
    expect(account.stateDir).toBeUndefined();
  });

  it('honours an explicit disable', () => {
    expect(resolveAccount(cfg({ enabled: false })).enabled).toBe(false);
  });

  it('only treats a literal false as disabled', () => {
    // A stray string in config must not silently take the channel offline.
    expect(resolveAccount(cfg({ enabled: 'no' })).enabled).toBe(false);
    expect(resolveAccount(cfg({ enabled: true })).enabled).toBe(true);
  });

  it('overrides the relay and trims whitespace', () => {
    const account = resolveAccount(cfg({ relayUrl: '  ws://localhost:8787  ' }));
    expect(account.relayUrl).toBe('ws://localhost:8787');
  });

  it('ignores blank overrides rather than dialling an empty URL', () => {
    expect(resolveAccount(cfg({ relayUrl: '   ' })).relayUrl).toBe(DEFAULT_RELAY_URL);
  });
});

describe('inspectAccount', () => {
  it('reports configured even with no config, because there is no secret to miss', () => {
    expect(inspectAccount(cfg())).toEqual({
      enabled: true,
      configured: true,
      tokenStatus: 'not-applicable',
    });
  });
});
