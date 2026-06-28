/**
 * Direct-mode connect flow: validate a host + API key against a live Hermes
 * before persisting anything. Pure orchestration over the adapter so it's
 * unit-testable without a network or the Keychain — the Connect screen calls
 * this, then hands the result to `addAgent`. See docs/AGENTS.md §5.
 */

import type { NewAgentInput } from './types';
import { buildAgent } from './registry';
import { makeAdapter as defaultMakeAdapter } from './adapters';

export type ConnectInput = { name: string; host: string; apiKey: string };

/** Validated agent + secret, ready for `addAgent(input, secret)`. */
export type ConnectOutcome = { input: NewAgentInput; secret: string };

export type ConnectDeps = { makeAdapter?: typeof defaultMakeAdapter };

/**
 * Probe a direct-mode Hermes with the typed credentials. Resolves with the
 * `NewAgentInput` (carrying the capabilities snapshot) + secret on success;
 * throws `ConnectionError` (from the adapter) on any failure so the screen can
 * show a specific message.
 */
export async function connectDirectAgent(
  { name, host, apiKey }: ConnectInput,
  deps: ConnectDeps = {},
): Promise<ConnectOutcome> {
  const makeAdapter = deps.makeAdapter ?? defaultMakeAdapter;
  const transient = buildAgent({
    name: name.trim() || 'Hermes',
    framework: 'hermes',
    transport: 'direct',
    baseUrl: host.trim(),
  });
  const adapter = makeAdapter(transient, async () => apiKey);
  const capabilities = await adapter.testConnection();
  return {
    input: {
      name: transient.name,
      framework: 'hermes',
      transport: 'direct',
      baseUrl: transient.baseUrl,
      capabilities,
    },
    secret: apiKey,
  };
}
