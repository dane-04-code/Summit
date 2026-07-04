import { describe, it, expect } from 'vitest';
import {
  makeInitialState,
  handleConnectorOpen,
  handleConnectorMessage,
  handleAppMessage,
  handleConnectorClose,
  handleAppClose,
} from '../logic';

describe('handleConnectorOpen', () => {
  it('stores the code with no effects (waits for hello)', () => {
    const { state, effects } = handleConnectorOpen(makeInitialState(), '481920');
    expect(state.code).toBe('481920');
    expect(effects).toEqual([]);
  });

  it('rejects a second connector with occupied', () => {
    const { state } = handleConnectorOpen(makeInitialState(), '481920');
    const result = handleConnectorOpen(state, '481920');
    expect(result.occupied).toBe(true);
  });
});

describe('handleConnectorMessage — hello', () => {
  it('stores connector info and replies with code', () => {
    const base = { ...makeInitialState(), code: '111111' };
    const { state, effects } = handleConnectorMessage(
      base,
      { t: 'hello', framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' },
      5_000,
    );
    expect(state.connectorInfo).toEqual({ framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
    // The code's short life starts when it's advertised (10-minute TTL).
    expect(state.codeExpiresAt).toBe(5_000 + 10 * 60_000);
    expect(effects).toEqual([{ to: 'connector', frame: { t: 'code', code: '111111' } }]);
  });
});

describe('handleConnectorMessage — passthrough', () => {
  it('forwards chunk/done/error to app', () => {
    const base = { ...makeInitialState(), code: '111111' };
    const chunk = { t: 'chunk' as const, reqId: 'r1', delta: 'hi' };
    const { effects } = handleConnectorMessage(base, chunk);
    expect(effects).toEqual([{ to: 'app', frame: chunk }]);
  });
});

const DEPS = { now: 1_000_000, mintToken: () => 'tok-fixed' };

function pairedState() {
  return {
    ...makeInitialState(),
    code: '111111',
    codeExpiresAt: DEPS.now + 60_000,
    connectorInfo: { framework: 'hermes', agentName: 'A', agentVersion: '1' },
  };
}

describe('handleAppMessage — pair', () => {
  it('sends paired with a session token when connector info is present', () => {
    const { state, effects } = handleAppMessage(pairedState(), { t: 'pair', code: '111111' }, DEPS);
    expect(effects).toEqual([{
      to: 'app',
      frame: { t: 'paired', framework: 'hermes', agentName: 'A', agentVersion: '1', sessionToken: 'tok-fixed' },
    }]);
    // Token is persisted so a later resume can be validated against it.
    expect(state.sessionToken).toBe('tok-fixed');
    expect(state.paired).toBe(true);
  });

  it('sends pair_error when connector not present', () => {
    const { effects } = handleAppMessage(makeInitialState(), { t: 'pair', code: '999999' }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'not_found' } }]);
  });
});

describe('handleAppMessage — pairing hardening', () => {
  it('refuses to pair a second time on the same code (single-use)', () => {
    const first = handleAppMessage(pairedState(), { t: 'pair', code: '111111' }, DEPS);
    const second = handleAppMessage(first.state, { t: 'pair', code: '111111' }, DEPS);
    expect(second.effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'expired' } }]);
  });

  it('refuses to pair once the code has expired', () => {
    const state = { ...pairedState(), codeExpiresAt: DEPS.now - 1 };
    const { effects } = handleAppMessage(state, { t: 'pair', code: '111111' }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'expired' } }]);
  });

  it('locks out after too many failed attempts', () => {
    let state = makeInitialState(); // no connector → every pair fails
    for (let i = 0; i < 5; i++) {
      state = handleAppMessage(state, { t: 'pair', code: '000000' }, DEPS).state;
    }
    const { effects } = handleAppMessage(state, { t: 'pair', code: '000000' }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'locked' } }]);
  });

  it('resumes an existing session with the right token', () => {
    const paired = handleAppMessage(pairedState(), { t: 'pair', code: '111111' }, DEPS).state;
    const { effects } = handleAppMessage(paired, { t: 'resume', token: 'tok-fixed' }, DEPS);
    expect(effects).toEqual([{
      to: 'app',
      frame: { t: 'paired', framework: 'hermes', agentName: 'A', agentVersion: '1', sessionToken: 'tok-fixed' },
    }]);
  });

  it('rejects a resume with the wrong token', () => {
    const paired = handleAppMessage(pairedState(), { t: 'pair', code: '111111' }, DEPS).state;
    const { effects } = handleAppMessage(paired, { t: 'resume', token: 'wrong' }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'not_found' } }]);
  });
});

describe('handleAppMessage — passthrough', () => {
  it('replies to app heartbeat without forwarding to connector', () => {
    const { effects } = handleAppMessage(makeInitialState(), { t: 'ping' });
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pong' } }]);
  });

  it('forwards chat to connector', () => {
    const chat = { t: 'chat' as const, reqId: 'r1', messages: [{ role: 'user' as const, content: 'hi' }] };
    const { effects } = handleAppMessage(makeInitialState(), chat);
    expect(effects).toEqual([{ to: 'connector', frame: chat }]);
  });
});

describe('peer_gone on close', () => {
  it('handleConnectorClose sends peer_gone to app', () => {
    const { effects } = handleConnectorClose(makeInitialState());
    expect(effects).toEqual([{ to: 'app', frame: { t: 'peer_gone' } }]);
  });

  it('handleAppClose sends peer_gone to connector', () => {
    const { effects } = handleAppClose(makeInitialState());
    expect(effects).toEqual([{ to: 'connector', frame: { t: 'peer_gone' } }]);
  });
});
