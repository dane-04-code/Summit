import { describe, it, expect } from 'vitest';
import {
  makeInitialState,
  handleAppOpen,
  handleAppClose,
  handleAppMessage,
  handleConnectorMessage,
} from '../logic';
import type { ChannelState } from '../logic';

const paired = (): ChannelState => ({
  ...makeInitialState(),
  code: '111111',
  connectorInfo: { framework: 'hermes', agentName: 'Hermes', agentVersion: '1' },
  connectorConnected: true,
});

const away = (): ChannelState => ({ ...paired(), pushToken: 'ExponentPushToken[t1]', appConnected: false });

describe('register_push', () => {
  it('stores the token with no effects', () => {
    const { state, effects } = handleAppMessage(paired(), {
      t: 'register_push',
      token: 'ExponentPushToken[t1]',
    }, {}, true);
    expect(state.pushToken).toBe('ExponentPushToken[t1]');
    expect(effects).toEqual([]);
  });

  it('is never forwarded to the connector', () => {
    const { effects } = handleAppMessage(paired(), { t: 'register_push', token: 'x' }, {}, true);
    expect(effects.find((e) => e.to === 'connector')).toBeUndefined();
  });
});

describe('app presence tracking', () => {
  it('handleAppOpen marks the app connected', () => {
    const state = handleAppOpen(makeInitialState());
    expect(state.appConnected).toBe(true);
  });

  it('handleAppClose marks the app away and keeps the token', () => {
    const opened = handleAppOpen(away());
    const { state } = handleAppClose(opened);
    expect(state.appConnected).toBe(false);
    expect(state.pushToken).toBe('ExponentPushToken[t1]');
  });
});

describe('push on turn completion', () => {
  it('pushes a content-free notification when done arrives with the app away', () => {
    const { effects } = handleConnectorMessage(away(), { t: 'done', reqId: 'r1' });
    expect(effects).toContainEqual({
      to: 'push',
      token: 'ExponentPushToken[t1]',
      title: 'Hermes',
      body: 'Finished a reply — open Summit to read it.',
    });
  });

  it('pushes when an error ends the turn with the app away', () => {
    const { effects } = handleConnectorMessage(away(), { t: 'error', reqId: 'r1', message: 'boom' });
    expect(effects).toContainEqual({
      to: 'push',
      token: 'ExponentPushToken[t1]',
      title: 'Hermes',
      body: 'Hit a problem and needs you.',
    });
  });

  it('does not push while the app is connected', () => {
    const connected = { ...away(), appConnected: true };
    const { effects } = handleConnectorMessage(connected, { t: 'done', reqId: 'r1' });
    expect(effects).toEqual([{ to: 'app', frame: { t: 'done', reqId: 'r1' } }]);
  });

  it('does not push mid-stream chunks', () => {
    const { effects } = handleConnectorMessage(away(), { t: 'chunk', reqId: 'r1', delta: 'hi' });
    expect(effects.find((e) => e.to === 'push')).toBeUndefined();
  });

  it('does not push without a registered token', () => {
    const { effects } = handleConnectorMessage(paired(), { t: 'done', reqId: 'r1' });
    expect(effects.find((e) => e.to === 'push')).toBeUndefined();
  });
});

describe('approval_req — pushed exec approvals', () => {
  it('forwards to the app and pushes content-free when the app is away', () => {
    const { effects } = handleConnectorMessage(away(), {
      t: 'approval_req',
      approvalId: 'ap-1',
      command: 'rm -rf /tmp/build',
    });
    expect(effects).toContainEqual({
      to: 'app',
      frame: { t: 'approval_req', approvalId: 'ap-1', command: 'rm -rf /tmp/build' },
    });
    // The command never transits push servers — body is generic.
    expect(effects).toContainEqual({
      to: 'push',
      token: 'ExponentPushToken[t1]',
      title: 'Hermes',
      body: 'Waiting for your approval.',
    });
  });

  it('only forwards while the app is connected', () => {
    const connected = { ...away(), appConnected: true };
    const { effects } = handleConnectorMessage(connected, {
      t: 'approval_req',
      approvalId: 'ap-1',
      command: 'ls',
    });
    expect(effects).toEqual([
      { to: 'app', frame: { t: 'approval_req', approvalId: 'ap-1', command: 'ls' } },
    ]);
  });
});

describe('notify — the agent-initiated nudge', () => {
  it('pushes the agent-chosen title and body when the app is away', () => {
    const { effects } = handleConnectorMessage(away(), {
      t: 'notify',
      title: 'Approval needed',
      body: 'Deploy to prod?',
    });
    expect(effects).toEqual([
      { to: 'push', token: 'ExponentPushToken[t1]', title: 'Approval needed', body: 'Deploy to prod?' },
    ]);
  });

  it('defaults the title to the agent name and the body to a nudge', () => {
    const { effects } = handleConnectorMessage(away(), { t: 'notify' });
    expect(effects).toEqual([
      { to: 'push', token: 'ExponentPushToken[t1]', title: 'Hermes', body: 'Needs your attention.' },
    ]);
  });

  it('forwards to the app instead of pushing when the app is connected', () => {
    const connected = { ...away(), appConnected: true };
    const { effects } = handleConnectorMessage(connected, { t: 'notify', title: 'x' });
    expect(effects).toEqual([{ to: 'app', frame: { t: 'notify', title: 'x' } }]);
  });

  it('drops silently when the app is away and no token is registered', () => {
    const { effects } = handleConnectorMessage(paired(), { t: 'notify', title: 'x' });
    expect(effects).toEqual([]);
  });
});
