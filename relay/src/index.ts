import { PairingChannel } from './channel';

export { PairingChannel };

export interface Env {
  PAIRING_CHANNEL: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Summit Relay — WebSocket only', { status: 200 });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (code) {
      // App connecting: route by existing code
      const id = env.PAIRING_CHANNEL.idFromName(code);
      const url2 = new URL(request.url);
      url2.searchParams.set('role', 'app');
      return env.PAIRING_CHANNEL.get(id).fetch(new Request(url2.toString(), request));
    }

    // Connector connecting: mint a unique 6-digit code
    for (let i = 0; i < 5; i++) {
      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      const id = env.PAIRING_CHANNEL.idFromName(newCode);
      const url2 = new URL(request.url);
      url2.searchParams.set('code', newCode);
      url2.searchParams.set('role', 'connector');
      const resp = await env.PAIRING_CHANNEL.get(id).fetch(new Request(url2.toString(), request));
      if (resp.status !== 409) return resp;
    }
    return new Response('Could not mint unique code', { status: 500 });
  },
};
