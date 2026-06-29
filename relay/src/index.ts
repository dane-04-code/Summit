import { PairingChannel } from './channel';
import { INSTALL_SCRIPT } from './install-script';

export { PairingChannel };

export interface Env {
  PAIRING_CHANNEL: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Serve the connector install script at get.summitapp.dev/connect
    if (url.hostname === 'get.summitapp.dev' && url.pathname === '/connect') {
      return new Response(INSTALL_SCRIPT, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Summit Relay — WebSocket only', { status: 200 });
    }

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
