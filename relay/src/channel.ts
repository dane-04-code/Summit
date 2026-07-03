import {
  makeInitialState,
  handleConnectorOpen,
  handleConnectorMessage,
  handleAppMessage,
  handleConnectorClose,
  handleAppClose,
} from './logic';
import type { ChannelState, SideEffect } from './logic';
import type { AnyFrame } from '../../protocol/protocol';

export class PairingChannel {
  private state: ChannelState = makeInitialState();

  constructor(private readonly doState: DurableObjectState) {
    // Reload persisted state on every wake — the DO hibernates between messages
    // and loses all in-memory state. Without this, connectorInfo is always null
    // when the app sends its pair frame.
    this.doState.blockConcurrencyWhile(async () => {
      const stored = await this.doState.storage.get<ChannelState>('state');
      if (stored) this.state = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get('role') as 'connector' | 'app';
    const code = url.searchParams.get('code')!;

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    if (role === 'connector') {
      const result = handleConnectorOpen(this.state, code);
      if (result.occupied) return new Response('Already occupied', { status: 409 });
      this.state = result.state;
      await this.doState.storage.put('state', this.state);
      this.doState.acceptWebSocket(server, ['connector']);
    } else {
      this.doState.acceptWebSocket(server, ['app']);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const frame = JSON.parse(
      typeof message === 'string' ? message : new TextDecoder().decode(message),
    ) as AnyFrame;
    const role = this.doState.getTags(ws)[0] as 'connector' | 'app';

    const result = role === 'connector'
      ? handleConnectorMessage(this.state, frame)
      : handleAppMessage(this.state, frame);

    if (result.state !== this.state) {
      this.state = result.state;
      await this.doState.storage.put('state', this.state);
    }
    this.dispatch(result.effects);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const role = this.doState.getTags(ws)[0] as 'connector' | 'app';
    const result = role === 'connector'
      ? handleConnectorClose(this.state)
      : handleAppClose(this.state);
    this.state = result.state;
    await this.doState.storage.put('state', this.state);
    this.dispatch(result.effects);
  }

  private dispatch(effects: SideEffect[]): void {
    const sockets = this.doState.getWebSockets();
    for (const effect of effects) {
      const target = sockets.find((s) => this.doState.getTags(s)[0] === effect.to);
      if (target) {
        target.send(JSON.stringify(effect.frame));
      } else if (effect.to === 'connector') {
        // Connector is not connected — tell the app rather than silently dropping.
        const app = sockets.find((s) => this.doState.getTags(s)[0] === 'app');
        const reqId = (effect.frame as Record<string, unknown>).reqId as string | undefined;
        app?.send(JSON.stringify({ t: 'error', reqId, message: 'Agent is offline. Tap Retry in the app to reconnect.' }));
      }
    }
  }
}
