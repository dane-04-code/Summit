import { PairingChannel } from './channel';
import { INSTALL_SCRIPT } from './install-script';

export { PairingChannel };

export interface Env {
  PAIRING_CHANNEL: DurableObjectNamespace;
  /** Override the Expo Push API endpoint. Unset in prod (defaults to exp.host);
   *  set via .dev.vars to point local tester loops at a sink. */
  PUSH_URL?: string;
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
    const claim = url.searchParams.get('claim');

    if (code) {
      // App connecting: route by existing code
      const id = env.PAIRING_CHANNEL.idFromName(code);
      const url2 = new URL(request.url);
      url2.searchParams.set('role', 'app');
      return env.PAIRING_CHANNEL.get(id).fetch(new Request(url2.toString(), request));
    }

    if (claim) {
      // Connector reconnecting: reclaim its saved code so the pairing code stays stable.
      const id = env.PAIRING_CHANNEL.idFromName(claim);
      const url2 = new URL(request.url);
      url2.searchParams.set('code', claim);
      url2.searchParams.set('role', 'connector');
      return env.PAIRING_CHANNEL.get(id).fetch(new Request(url2.toString(), request));
    }

    // Connector connecting for the first time: mint a unique 6-digit code.
    // Crypto-grade randomness — Math.random is predictable and must not gate access.
    for (let i = 0; i < 5; i++) {
      const newCode = String((crypto.getRandomValues(new Uint32Array(1))[0] % 900000) + 100000);
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
