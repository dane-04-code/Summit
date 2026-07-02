import {
  RelayError,
  RELAY_ERROR_MESSAGES,
  isPairingCodeError,
  type RelayErrorCode,
} from '@/agents/relay/errors';

describe('RelayError', () => {
  it('is an Error carrying a machine-readable code', () => {
    const err = new RelayError('code_expired');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RelayError');
    expect(err.code).toBe('code_expired');
  });

  it('defaults its message to the user-readable copy for the code', () => {
    const err = new RelayError('relay_unreachable');
    expect(err.message).toBe(RELAY_ERROR_MESSAGES.relay_unreachable);
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('allows an explicit message override', () => {
    const err = new RelayError('agent_disconnected', 'connector.go crashed');
    expect(err.code).toBe('agent_disconnected');
    expect(err.message).toBe('connector.go crashed');
  });

  it('has a non-empty, non-code message for every pairing failure kind', () => {
    const codes: RelayErrorCode[] = [
      'relay_unreachable',
      'code_not_found',
      'code_expired',
      'already_paired',
      'agent_disconnected',
    ];
    for (const code of codes) {
      const message = RELAY_ERROR_MESSAGES[code];
      expect(typeof message).toBe('string');
      expect(message.trim().length).toBeGreaterThan(0);
      // Never leak the raw protocol code to the user.
      expect(message).not.toBe(code);
    }
  });
});

describe('isPairingCodeError', () => {
  it('is true when the entered code is the problem', () => {
    expect(isPairingCodeError('code_not_found')).toBe(true);
    expect(isPairingCodeError('code_expired')).toBe(true);
    expect(isPairingCodeError('already_paired')).toBe(true);
  });

  it('is false for transport failures unrelated to the code', () => {
    expect(isPairingCodeError('relay_unreachable')).toBe(false);
    expect(isPairingCodeError('agent_disconnected')).toBe(false);
  });
});
