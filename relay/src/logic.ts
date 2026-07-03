import type { AnyFrame, PairedFrame, PairErrorFrame, PeerGoneFrame } from '../../protocol/protocol';

export type ConnectorInfo = { framework: string; agentName: string; agentVersion: string };

export type ChannelState = {
  code: string | null;
  connectorInfo: ConnectorInfo | null;
  connectorConnected: boolean;
};

export type SideEffect =
  | { to: 'connector'; frame: AnyFrame }
  | { to: 'app'; frame: AnyFrame };

export type HandleResult = { state: ChannelState; effects: SideEffect[]; occupied?: boolean };

export function makeInitialState(): ChannelState {
  return { code: null, connectorInfo: null, connectorConnected: false };
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
  // chunk / done / error — forward to app
  return { state, effects: [{ to: 'app', frame }] };
}

export function handleAppMessage(state: ChannelState, frame: AnyFrame): HandleResult {
  if (frame.t === 'ping') {
    return { state, effects: [{ to: 'app', frame: { t: 'pong' } }] };
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
  return { state, effects: [{ to: 'connector', frame: gone }] };
}
