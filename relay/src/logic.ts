import type { AnyFrame, PairedFrame, PairErrorFrame, PeerGoneFrame } from '../../protocol/protocol';

export type ConnectorInfo = { framework: string; agentName: string; agentVersion: string };

export type ChannelState = {
  code: string | null;
  connectorInfo: ConnectorInfo | null;
  connectorConnected: boolean;
  /** Expo push token registered by the app; survives hibernation + reconnects. */
  pushToken: string | null;
  /** Whether an app socket is currently attached — pushes only fire when it isn't. */
  appConnected: boolean;
};

export type SideEffect =
  | { to: 'connector'; frame: AnyFrame }
  | { to: 'app'; frame: AnyFrame }
  | { to: 'push'; token: string; title: string; body: string };

export type HandleResult = { state: ChannelState; effects: SideEffect[]; occupied?: boolean };

export function makeInitialState(): ChannelState {
  return {
    code: null,
    connectorInfo: null,
    connectorConnected: false,
    pushToken: null,
    appConnected: false,
  };
}

export function handleConnectorOpen(state: ChannelState, code: string): HandleResult {
  // Occupied only when a connector is actively connected right now.
  // A code left over from a previous (now-closed) connection is not occupied.
  if (state.connectorConnected) {
    return { state, effects: [], occupied: true };
  }
  // Store the code; wait for hello before replying with it
  return { state: { ...state, code, connectorConnected: true }, effects: [] };
}

export function handleAppOpen(state: ChannelState): ChannelState {
  return { ...state, appConnected: true };
}

/** Push effect for an agent event, or null when the app is watching / no token. */
function pushFor(state: ChannelState, title: string | undefined, body: string | undefined): SideEffect | null {
  if (state.appConnected || !state.pushToken) return null;
  return {
    to: 'push',
    token: state.pushToken,
    title: title || state.connectorInfo?.agentName || 'Your agent',
    body: body || 'Needs your attention.',
  };
}

export function handleConnectorMessage(state: ChannelState, frame: AnyFrame): HandleResult {
  if (frame.t === 'hello') {
    return {
      state: {
        ...state,
        connectorInfo: { framework: frame.framework, agentName: frame.agentName, agentVersion: frame.agentVersion },
      },
      effects: [{ to: 'connector', frame: { t: 'code', code: state.code! } }],
    };
  }
  if (frame.t === 'ping') {
    // Application-level heartbeat — reply immediately so Cloudflare's idle timer
    // resets. Control-frame pings don't reset it; JSON messages do.
    return { state, effects: [{ to: 'connector', frame: { t: 'pong' } }] };
  }
  if (frame.t === 'notify') {
    // Agent-initiated nudge: in-thread frame when the app is watching, push
    // when it's away. The agent chose title/body deliberately — send them.
    if (state.appConnected) {
      return { state, effects: [{ to: 'app', frame }] };
    }
    const push = pushFor(state, frame.title, frame.body);
    return { state, effects: push ? [push] : [] };
  }
  // chunk / done / error — forward to app; a finished turn the app didn't see
  // becomes a push. Content stays out of the notification (it would transit
  // Expo/Apple servers; the transcript is on-device only).
  const effects: SideEffect[] = [{ to: 'app', frame }];
  if (frame.t === 'done') {
    const push = pushFor(state, undefined, 'Finished a reply — open Summit to read it.');
    if (push) effects.push(push);
  } else if (frame.t === 'error') {
    const push = pushFor(state, undefined, 'Hit a problem and needs you.');
    if (push) effects.push(push);
  }
  return { state, effects };
}

export function handleAppMessage(state: ChannelState, frame: AnyFrame): HandleResult {
  if (frame.t === 'ping') {
    return { state, effects: [{ to: 'app', frame: { t: 'pong' } }] };
  }

  if (frame.t === 'register_push') {
    return { state: { ...state, pushToken: frame.token }, effects: [] };
  }

  if (frame.t === 'pair') {
    if (!state.connectorInfo) {
      const reply: PairErrorFrame = { t: 'pair_error', reason: 'not_found' };
      return { state, effects: [{ to: 'app', frame: reply }] };
    }
    const reply: PairedFrame = { t: 'paired', ...state.connectorInfo };
    return { state, effects: [{ to: 'app', frame: reply }] };
  }
  // chat — forward to connector
  return { state, effects: [{ to: 'connector', frame }] };
}

export function handleConnectorClose(state: ChannelState): HandleResult {
  const gone: PeerGoneFrame = { t: 'peer_gone' };
  return { state: { ...state, connectorInfo: null, connectorConnected: false }, effects: [{ to: 'app', frame: gone }] };
}

export function handleAppClose(state: ChannelState): HandleResult {
  const gone: PeerGoneFrame = { t: 'peer_gone' };
  return { state: { ...state, appConnected: false }, effects: [{ to: 'connector', frame: gone }] };
}
