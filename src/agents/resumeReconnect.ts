/**
 * Foreground-resume recovery. iOS suspends and usually closes the relay socket
 * while the app is backgrounded, so coming back to a paired agent should
 * silently re-establish the connection rather than wait for the user's next
 * message to notice it's gone.
 *
 * Only a *settled-bad* state reconnects: a healthy socket is left untouched
 * (reconnecting it would tear down a possibly-streaming turn), an in-flight
 * connect is left to finish, and an expired pairing needs a re-pair, not a
 * retry. The attempt is fire-and-forget and can never throw into the caller.
 */

import type { AgentAdapter } from './adapters/types';
import { captureError } from '@/lib/errorReporting';

type Reconnectable = Pick<AgentAdapter, 'getConnectionState' | 'retryConnection'>;

export function reconnectIfDropped(adapter: Reconnectable): void {
  const state = adapter.getConnectionState();
  if (state !== 'disconnected' && state !== 'unknown') return;
  void adapter.retryConnection().catch((e) => {
    captureError(e, { where: 'resume_reconnect', transport: 'relay' });
  });
}
