/**
 * Typed relay failures. Each `RelayErrorCode` names a real pairing/transport
 * failure path so the UI can show specific, user-readable copy instead of a
 * bare "WebSocket error" or a raw protocol reason like "not_found".
 *
 * The default message per code lives here so every consumer (pair screen today,
 * settings/re-pair later) shows the same wording — a single source of truth.
 */

export type RelayErrorCode =
  | 'relay_unreachable' // couldn't open the socket to the relay
  | 'code_not_found' // relay has no connector waiting on this code
  | 'code_expired' // the pairing code has aged out
  | 'already_paired' // the code was already claimed
  | 'agent_disconnected'; // the connector dropped mid-handshake

export const RELAY_ERROR_MESSAGES: Record<RelayErrorCode, string> = {
  relay_unreachable:
    'Agent disconnected. Check that the connector is running and try again.',
  code_not_found:
    "That code wasn't found. Make sure your agent's connector is still running, then re-check the code.",
  code_expired: 'That pairing code has expired. Ask your agent for a fresh code.',
  already_paired: 'That code was already used. Ask your agent for a new one.',
  agent_disconnected:
    'Your agent went offline. Restart the connector and try again.',
};

/**
 * True when the failure means the 6-digit code the user typed is the problem
 * (so the code field should show an error), rather than a transport failure
 * where the code is fine but the relay/connector is unavailable.
 */
export function isPairingCodeError(code: RelayErrorCode): boolean {
  return (
    code === 'code_not_found' ||
    code === 'code_expired' ||
    code === 'already_paired'
  );
}

export class RelayError extends Error {
  readonly code: RelayErrorCode;

  constructor(code: RelayErrorCode, message?: string) {
    super(message ?? RELAY_ERROR_MESSAGES[code]);
    this.name = 'RelayError';
    this.code = code;
  }
}
