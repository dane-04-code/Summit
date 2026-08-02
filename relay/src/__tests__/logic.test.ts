import { describe, it, expect } from 'vitest';
import {
  makeInitialState,
  handleConnectorOpen,
  handleConnectorMessage,
  handleAppMessage,
  handleConnectorClose,
  handleAppClose,
  credentialMatches,
} from '../logic';

describe('durable credentials', () => {
  const token = 't'.repeat(43);

  it('accepts only the complete strong credential', () => {
    expect(credentialMatches(token, token)).toBe(true);
    expect(credentialMatches(token, `${token.slice(0, -1)}x`)).toBe(false);
    expect(credentialMatches(token, null)).toBe(false);
  });

  it('never treats a short pairing code as a durable credential', () => {
    expect(credentialMatches('481920', '481920')).toBe(false);
    expect(credentialMatches('K7M29XQP', 'K7M29XQP')).toBe(false);
  });

  it('rejects a matching prefix without leaking where the compare stopped', () => {
    // Length is checked openly (it is not secret), then every remaining byte is
    // compared — no short-circuit on the first mismatch.
    expect(credentialMatches(token, `${token.slice(0, 42)}x`)).toBe(false);
    expect(credentialMatches(token, token.slice(0, 42))).toBe(false);
    expect(credentialMatches(token, `${token}x`)).toBe(false);
  });
});

describe('handleConnectorOpen', () => {
  it('stores the code with no effects (waits for hello)', () => {
    const { state, effects } = handleConnectorOpen(makeInitialState(), 'K7M29XQP');
    expect(state.code).toBe('K7M29XQP');
    expect(effects).toEqual([]);
  });

  it('rejects a second connector with occupied', () => {
    const { state } = handleConnectorOpen(makeInitialState(), 'K7M29XQP');
    const result = handleConnectorOpen(state, 'K7M29XQP');
    expect(result.occupied).toBe(true);
  });

  it('accepts a reconnect when persisted presence is stale but no socket is live', () => {
    const stale = { ...makeInitialState(), connectorConnected: true };
    const result = handleConnectorOpen(stale, 'K7M29XQP', false);

    expect(result.occupied).toBeUndefined();
    expect(result.state).toMatchObject({ code: 'K7M29XQP', connectorConnected: true });
  });

  it('rejects a duplicate when a socket is live even if persisted presence is stale false', () => {
    const result = handleConnectorOpen(makeInitialState(), 'K7M29XQP', true);

    expect(result.occupied).toBe(true);
  });
});

describe('handleConnectorMessage — hello', () => {
  const ROTATING = {
    t: 'hello' as const,
    framework: 'hermes',
    agentName: 'My Agent',
    agentVersion: '2.1',
    capabilities: ['code_rotation' as const],
  };

  it('stores connector info and replies with code', () => {
    const base = { ...makeInitialState(), code: 'K7M29XQP', connectorToken: 'c'.repeat(43) };
    const { state, effects } = handleConnectorMessage(
      base,
      { t: 'hello', framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' },
      5_000,
    );
    expect(state.connectorInfo).toEqual({ framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
    // No code_rotation capability: this connector cannot fetch a replacement,
    // so it keeps the original longer TTL rather than being stranded.
    expect(state.codeExpiresAt).toBe(5_000 + 10 * 60_000);
    expect(effects[0]).toMatchObject({ to: 'connector', frame: { t: 'code', code: 'K7M29XQP' } });
    expect(state.connectorToken).toBe('c'.repeat(43));
  });

  it('gives a rotating connector the short window', () => {
    const base = { ...makeInitialState(), code: 'K7M29XQP' };
    const { state, effects } = handleConnectorMessage(base, ROTATING, 5_000);

    expect(state.codeExpiresAt).toBe(5_000 + 3 * 60_000);
    // The deadline goes on the wire so the connector can time its own refresh.
    expect(effects[0]).toMatchObject({
      to: 'connector',
      frame: { t: 'code', expiresAt: 5_000 + 3 * 60_000 },
    });
  });

  it('never pushes an existing deadline forward on reconnect', () => {
    const base = { ...makeInitialState(), code: 'K7M29XQP' };
    const first = handleConnectorMessage(base, ROTATING, 5_000).state;
    // A connector stuck in a restart loop must not be able to hold one code
    // open indefinitely — that is the window a sweep wants.
    const second = handleConnectorMessage(first, ROTATING, 100_000).state;

    expect(second.codeExpiresAt).toBe(5_000 + 3 * 60_000);
  });

  it('tells an already-paired connector its code is spent instead of reprinting it', () => {
    const base = { ...makeInitialState(), code: 'K7M29XQP', paired: true, codeExpiresAt: 1 };
    const { effects } = handleConnectorMessage(base, ROTATING, 5_000);

    expect(effects[0]).toMatchObject({
      to: 'connector',
      frame: { t: 'code', code: 'K7M29XQP', paired: true },
    });
    expect((effects[0] as { frame: { expiresAt?: number } }).frame.expiresAt).toBeUndefined();
  });

  it('carries connector capabilities through to the paired app', () => {
    const base = { ...makeInitialState(), code: 'K7M29XQP' };
    const { state } = handleConnectorMessage(base, {
      t: 'hello',
      framework: 'hermes',
      agentName: 'My Agent',
      agentVersion: '2.1',
      capabilities: ['model_picker'],
    });
    const paired = handleAppMessage(
      { ...state, sessionToken: 's'.repeat(43) },
      { t: 'resume', token: 's'.repeat(43) },
    );
    expect(paired.effects[0]).toMatchObject({
      to: 'app',
      frame: { t: 'paired', capabilities: ['model_picker'] },
    });
  });
});

describe('handleConnectorMessage — model picker', () => {
  it('forwards a model catalogue to the app with no notification', () => {
    const base = { ...makeInitialState(), code: 'K7M29XQP', pushToken: 'tok', appConnected: false };
    const models = {
      t: 'models' as const,
      reqId: 'r1',
      currentModel: 'claude-sonnet-5',
      currentProvider: 'anthropic',
      providers: [],
    };
    const { effects } = handleConnectorMessage(base, models);
    // A picker payload is UI state, never something to wake the phone for.
    expect(effects).toEqual([{ to: 'app', frame: models }]);
  });
});

describe('handleAppMessage — model picker', () => {
  it('forwards an authenticated model request to the connector', () => {
    const request = {
      t: 'models_req' as const,
      reqId: 'r1',
      sessionId: 's1',
      scope: 'session' as const,
    };
    const { effects } = handleAppMessage(makeInitialState(), request, {}, true);
    expect(effects).toEqual([{ to: 'connector', frame: request }]);
  });

  it('refuses a model request from an unauthenticated socket', () => {
    const request = {
      t: 'model_select' as const,
      reqId: 'r1',
      sessionId: 's1',
      provider: 'anthropic',
      model: 'claude-opus-5',
    };
    const { effects } = handleAppMessage(makeInitialState(), request, {}, false);
    expect(effects).toMatchObject([{ to: 'app', frame: { t: 'error' } }]);
  });
});

describe('handleConnectorMessage — passthrough', () => {
  it('forwards ephemeral activity to the app without persisting it', () => {
    const base = { ...makeInitialState(), code: 'K7M29XQP' };
    const activity = { t: 'activity' as const, reqId: 'r1', label: 'Thinking…' };
    const { effects } = handleConnectorMessage(base, activity);
    expect(effects).toEqual([{ to: 'app', frame: activity }]);
  });
});

const DEPS = { now: 1_000_000, mintToken: () => 'tok-fixed' };

const CODE = 'K7M29XQP';

function pairedState() {
  return {
    ...makeInitialState(),
    code: CODE,
    codeExpiresAt: DEPS.now + 60_000,
    connectorInfo: { framework: 'hermes', agentName: 'A', agentVersion: '1' },
  };
}

describe('handleAppMessage — pair', () => {
  it('sends paired with a session token when connector info is present', () => {
    const { state, effects } = handleAppMessage(pairedState(), { t: 'pair', code: CODE }, DEPS);
    expect(effects).toEqual([
      {
        to: 'app',
        frame: { t: 'paired', framework: 'hermes', agentName: 'A', agentVersion: '1', sessionToken: 'tok-fixed' },
      },
      // The connector needs to know too, so it stops its rotation timer.
      { to: 'connector', frame: { t: 'pair_ok' } },
    ]);
    // Token is persisted so a later resume can be validated against it.
    expect(state.sessionToken).toBe('tok-fixed');
    expect(state.paired).toBe(true);
  });

  it('sends pair_error when connector not present', () => {
    const { effects } = handleAppMessage(makeInitialState(), { t: 'pair', code: 'ZZZZZZZZ' }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'not_found' } }]);
  });

  it('refuses a frame whose code disagrees with the channel it reached', () => {
    // Routing already happened by URL param, so a mismatch is a malformed or
    // probing client. Answer exactly as for a miss — never hint at the reason.
    const { state, effects } = handleAppMessage(pairedState(), { t: 'pair', code: 'ZZZZZZZZ' }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'not_found' } }]);
    expect(state.paired).toBe(false);
    // And it counts toward the lockout, so it is not a free probe.
    expect(state.failedPairs).toBe(1);
  });
});

describe('handleAppMessage — pairing hardening', () => {
  it('refuses to pair a second time on the same code (single-use)', () => {
    const first = handleAppMessage(pairedState(), { t: 'pair', code: CODE }, DEPS);
    const second = handleAppMessage(first.state, { t: 'pair', code: CODE }, DEPS);
    expect(second.effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'expired' } }]);
  });

  it('refuses to pair once the code has expired', () => {
    const state = { ...pairedState(), codeExpiresAt: DEPS.now - 1 };
    const { effects } = handleAppMessage(state, { t: 'pair', code: CODE }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'expired' } }]);
  });

  it('locks out after too many failed attempts', () => {
    let state = makeInitialState(); // no connector → every pair fails
    for (let i = 0; i < 5; i++) {
      state = handleAppMessage(state, { t: 'pair', code: 'ZZZZZZZZ' }, DEPS).state;
    }
    const { effects } = handleAppMessage(state, { t: 'pair', code: 'ZZZZZZZZ' }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'locked' } }]);
  });

  it('resumes an existing session with the right token', () => {
    const paired = handleAppMessage(pairedState(), { t: 'pair', code: CODE }, DEPS).state;
    const { effects } = handleAppMessage(paired, { t: 'resume', token: 'tok-fixed' }, DEPS);
    expect(effects).toEqual([{
      to: 'app',
      frame: { t: 'paired', framework: 'hermes', agentName: 'A', agentVersion: '1', sessionToken: 'tok-fixed' },
    }]);
  });

  it('rejects a resume with the wrong token', () => {
    const paired = handleAppMessage(pairedState(), { t: 'pair', code: CODE }, DEPS).state;
    const { effects } = handleAppMessage(paired, { t: 'resume', token: 'wrong' }, DEPS);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'not_found' } }]);
  });
});

describe('handleAppMessage — passthrough', () => {
  it('replies to app heartbeat without forwarding to connector', () => {
    const { effects } = handleAppMessage(makeInitialState(), { t: 'ping' });
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pong' } }]);
  });

  it('rejects chat before relay authentication', () => {
    const chat = { t: 'chat' as const, reqId: 'r1', messages: [{ role: 'user' as const, content: 'hi' }] };
    const { effects } = handleAppMessage(makeInitialState(), chat);
    expect(effects).toEqual([{ to: 'app', frame: { t: 'error', message: 'Relay authentication required.' } }]);
  });

  it('forwards chat after relay authentication', () => {
    const chat = { t: 'chat' as const, reqId: 'r1', messages: [{ role: 'user' as const, content: 'hi' }] };
    const { effects } = handleAppMessage(makeInitialState(), chat, {}, true);
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
