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

  constructor(private readonly doState: DurableObjectState) {}

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

    this.state = result.state;
    this.dispatch(result.effects);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const role = this.doState.getTags(ws)[0] as 'connector' | 'app';
    const result = role === 'connector'
      ? handleConnectorClose(this.state)
      : handleAppClose(this.state);
    this.state = result.state;
    this.dispatch(result.effects);
  }

  private dispatch(effects: SideEffect[]): void {
    const sockets = this.doState.getWebSockets();
    for (const effect of effects) {
      const target = sockets.find((s) => this.doState.getTags(s)[0] === effect.to);
      target?.send(JSON.stringify(effect.frame));
    }
  }
}
