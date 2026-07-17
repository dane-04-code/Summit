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
  /** When the 6-digit code stops being usable for pairing (short-lived handshake). */
  codeExpiresAt: number | null;
  /** Durable credential minted at pair time; the app reconnects with this, not the code. */
  sessionToken: string | null;
  /** Strong credential used by the connector after its first connection. */
  connectorToken: string | null;
  /** The code is single-use: true once a successful pair has happened. */
  paired: boolean;
  /** Consecutive failed pair attempts, for lockout. */
  failedPairs: number;
  /** Lockout expiry after too many failed attempts. */
  lockedUntil: number | null;
};

/** Pairing hardening knobs. */
const CODE_TTL_MS = 10 * 60_000;
const MAX_FAILED_PAIRS = 5;
const LOCK_MS = 15 * 60_000;

/** Injected clock + token source so the pure logic stays deterministic in tests. */
export type AppDeps = { now?: number; mintToken?: () => string };
const defaultMintToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
};

export type SideEffect =
  | { to: 'connector'; frame: AnyFrame }
  | { to: 'app'; frame: AnyFrame }
  | { to: 'push'; token: string; title: string; body: string };

export type HandleResult = { state: ChannelState; effects: SideEffect[]; occupied?: boolean };

export function credentialMatches(expected: string | null | undefined, presented: string | null): boolean {
  return typeof expected === 'string' && expected.length >= 43 && presented === expected;
}

export function makeInitialState(): ChannelState {
  return {
    code: null,
    connectorInfo: null,
    connectorConnected: false,
    pushToken: null,
    appConnected: false,
    codeExpiresAt: null,
    sessionToken: null,
    connectorToken: null,
    paired: false,
    failedPairs: 0,
    lockedUntil: null,
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

export function handleConnectorMessage(state: ChannelState, frame: AnyFrame, now: number = Date.now()): HandleResult {
  if (frame.t === 'hello') {
    const connectorToken = state.connectorToken ?? defaultMintToken();
    return {
      state: {
        ...state,
        connectorToken,
        connectorInfo: { framework: frame.framework, agentName: frame.agentName, agentVersion: frame.agentVersion },
        // The code is only advertised now, so start its short life here.
        codeExpiresAt: now + CODE_TTL_MS,
      },
      effects: [{ to: 'connector', frame: { t: 'code', code: state.code!, connectorToken } }],
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
  } else if (frame.t === 'approval_req') {
    // A blocked run waiting on the user is the strongest push case of all —
    // but the command stays out of the notification (content-free).
    const push = pushFor(state, undefined, 'Waiting for your approval.');
    if (push) effects.push(push);
  }
  return { state, effects };
}

export function handleAppMessage(
  state: ChannelState,
  frame: AnyFrame,
  deps: AppDeps = {},
  authenticated = false,
): HandleResult {
  const now = deps.now ?? Date.now();
  const mintToken = deps.mintToken ?? defaultMintToken;

  if (frame.t === 'ping') {
    return { state, effects: [{ to: 'app', frame: { t: 'pong' } }] };
  }

  if (frame.t === 'resume') {
    // Reconnect with the durable token. No token match = treat as unknown, never
    // reveal whether a connector is present.
    if (state.sessionToken && frame.token === state.sessionToken && state.connectorInfo) {
      const reply: PairedFrame = { t: 'paired', ...state.connectorInfo, sessionToken: state.sessionToken };
      return { state, effects: [{ to: 'app', frame: reply }] };
    }
    const reply: PairErrorFrame = { t: 'pair_error', reason: 'not_found' };
    return { state, effects: [{ to: 'app', frame: reply }] };
  }

  if (frame.t === 'pair') {
    // Locked out after repeated failures — refuse before doing anything else.
    if (state.lockedUntil !== null && now < state.lockedUntil) {
      return { state, effects: [{ to: 'app', frame: { t: 'pair_error', reason: 'locked' } }] };
    }
    // No connector on this code: a miss. Count it, and lock the channel once the
    // misses pile up so a single code can't be hammered.
    if (!state.connectorInfo) {
      const failedPairs = state.failedPairs + 1;
      const lockedUntil = failedPairs >= MAX_FAILED_PAIRS ? now + LOCK_MS : state.lockedUntil;
      return {
        state: { ...state, failedPairs, lockedUntil },
        effects: [{ to: 'app', frame: { t: 'pair_error', reason: 'not_found' } }],
      };
    }
    // Single-use + short-lived: a code already spent, or past its window, is dead.
    if (state.paired || (state.codeExpiresAt !== null && now > state.codeExpiresAt)) {
      return { state, effects: [{ to: 'app', frame: { t: 'pair_error', reason: 'expired' } }] };
    }
    // Success: mint the durable session token, retire the code.
    const sessionToken = mintToken();
    const reply: PairedFrame = { t: 'paired', ...state.connectorInfo, sessionToken };
    return {
      state: { ...state, paired: true, sessionToken, failedPairs: 0 },
      effects: [{ to: 'app', frame: reply }],
    };
  }

  if (!authenticated) {
    return {
      state,
      effects: [{ to: 'app', frame: { t: 'error', message: 'Relay authentication required.' } }],
    };
  }
  if (frame.t === 'register_push') {
    return { state: { ...state, pushToken: frame.token }, effects: [] };
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
