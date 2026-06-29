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
    );
    expect(state.connectorInfo).toEqual({ framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
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

describe('handleAppMessage — pair', () => {
  it('sends paired when connector info is present', () => {
    const state = {
      ...makeInitialState(),
      code: '111111',
      connectorInfo: { framework: 'hermes', agentName: 'A', agentVersion: '1' },
    };
    const { effects } = handleAppMessage(state, { t: 'pair', code: '111111' });
    expect(effects).toEqual([{
      to: 'app',
      frame: { t: 'paired', framework: 'hermes', agentName: 'A', agentVersion: '1' },
    }]);
  });

  it('sends pair_error when connector not present', () => {
    const { effects } = handleAppMessage(makeInitialState(), { t: 'pair', code: '999999' });
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'not_found' } }]);
  });
});

describe('handleAppMessage — passthrough', () => {
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
