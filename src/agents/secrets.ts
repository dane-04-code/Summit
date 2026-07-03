/**
 * The ONLY place an agent secret is stored: the iOS Keychain via
 * expo-secure-store. `direct` transport stores the Hermes API key; `relay`
 * stores the relay device token. One secret per agent, read lazily — only
 * when a network call needs it. See `docs/AGENTS.md` §4.
 */

import * as SecureStore from 'expo-secure-store';

// SecureStore keys must match [A-Za-z0-9._-]; agent ids are base36, so safe.
const keyFor = (agentId: string) => `agent.${agentId}.secret`;

export function getAgentSecret(agentId: string): Promise<string | null> {
  return SecureStore.getItemAsync(keyFor(agentId));
}

export function setAgentSecret(agentId: string, secret: string): Promise<void> {
  return SecureStore.setItemAsync(keyFor(agentId), secret);
}

export function deleteAgentSecret(agentId: string): Promise<void> {
  return SecureStore.deleteItemAsync(keyFor(agentId));
}
