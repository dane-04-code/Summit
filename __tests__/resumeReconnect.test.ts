/**
 * When the app comes back to the foreground, a connection that quietly died
 * while the phone slept should heal itself — but a healthy or mid-flight
 * connection must be left alone, and a reconnect that fails must never throw
 * into the resume handler.
 */

import type { ConnectionState } from '@/agents/adapters/types';

const mockCaptureError = jest.fn();
jest.mock('@/lib/errorReporting', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

import { reconnectIfDropped } from '@/agents/resumeReconnect';

function fakeAdapter(state: ConnectionState, retry = jest.fn().mockResolvedValue(undefined)) {
  return {
    getConnectionState: () => state,
    retryConnection: retry,
  };
}

describe('reconnectIfDropped', () => {
  beforeEach(() => mockCaptureError.mockReset());

  it.each<ConnectionState>(['disconnected', 'unknown'])(
    'reconnects when the connection is settled-bad (%s)',
    (state) => {
      const retry = jest.fn().mockResolvedValue(undefined);
      reconnectIfDropped(fakeAdapter(state, retry));
      expect(retry).toHaveBeenCalledTimes(1);
    },
  );

  it.each<ConnectionState>(['connected', 'connecting', 'reconnecting', 'pairing_expired'])(
    'leaves a healthy, in-flight, or re-pair-needed connection alone (%s)',
    (state) => {
      const retry = jest.fn().mockResolvedValue(undefined);
      reconnectIfDropped(fakeAdapter(state, retry));
      expect(retry).not.toHaveBeenCalled();
    },
  );

  it('reports — never throws — when the reconnect attempt rejects', async () => {
    const retry = jest.fn().mockRejectedValue(new Error('relay still unreachable'));
    expect(() => reconnectIfDropped(fakeAdapter('disconnected', retry))).not.toThrow();
    // Let the rejected promise settle so the catch runs.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    expect(mockCaptureError.mock.calls[0][1]).toMatchObject({ where: 'resume_reconnect' });
  });
});
