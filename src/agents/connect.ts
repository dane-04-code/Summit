/**
 * Direct-mode connect flow: validate a host + API key against a live server
 * before persisting anything. The framework is detected, never chosen — probe
 * Hermes first (`/v1/capabilities`), and if the server answers but isn't
 * Hermes, fall back to the generic OpenAI probe (`/v1/models`). The user just
 * sees what their agent can do. Pure orchestration over the adapters so it's
 * unit-testable without a network or the Keychain — the Connect screen calls
 * this, then hands the result to `addAgent`. See docs/AGENTS.md §5.
 */

import type { AgentCapabilities, AgentFramework, NewAgentInput } from './types';
import { buildAgent } from './registry';
import { makeAdapter as defaultMakeAdapter, ConnectionError } from './adapters';

export type ConnectInput = { name: string; host: string; apiKey: string };

/** Validated agent + secret, ready for `addAgent(input, secret)`. */
export type ConnectOutcome = { input: NewAgentInput; secret: string };

export type ConnectDeps = { makeAdapter?: typeof defaultMakeAdapter };

const DEFAULT_NAMES: Partial<Record<AgentFramework, string>> = {
  hermes: 'Hermes',
  openai: 'Agent',
};

/**
 * Probe a direct-mode server with the typed credentials, detecting whether it
 * speaks Hermes or the generic OpenAI API. Resolves with the `NewAgentInput`
 * (carrying the capabilities snapshot) + secret on success; throws
 * `ConnectionError` so the screen can show a specific message.
 */
export async function connectDirectAgent(
  { name, host, apiKey }: ConnectInput,
  deps: ConnectDeps = {},
): Promise<ConnectOutcome> {
  const makeAdapter = deps.makeAdapter ?? defaultMakeAdapter;
  const baseUrl = host.trim();

  const probe = async (framework: AgentFramework): Promise<AgentCapabilities> => {
    const transient = buildAgent({
      name: 'probe',
      framework,
      transport: 'direct',
      baseUrl,
    });
    return makeAdapter(transient, async () => apiKey).testConnection();
  };

  const outcome = (framework: AgentFramework, capabilities: AgentCapabilities): ConnectOutcome => ({
    input: {
      name: name.trim() || DEFAULT_NAMES[framework] || 'Agent',
      framework,
      transport: 'direct',
      baseUrl,
      capabilities,
    },
    secret: apiKey,
  });

  try {
    return outcome('hermes', await probe('hermes'));
  } catch (err) {
    // Unreachable means nothing else will work; unauthorized means we did
    // reach a keyed server. Only "answered, but not Hermes" falls through.
    if (
      err instanceof ConnectionError &&
      (err.kind === 'unreachable' || err.kind === 'unauthorized')
    ) {
      throw err;
    }
  }

  try {
    return outcome('openai', await probe('openai'));
  } catch (err) {
    if (
      err instanceof ConnectionError &&
      (err.kind === 'unreachable' || err.kind === 'unauthorized')
    ) {
      throw err;
    }
    throw new ConnectionError(
      'wrong-shape',
      "Reached the server, but it doesn't look like a supported agent API.",
    );
  }
}
