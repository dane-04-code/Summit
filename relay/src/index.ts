import { PairingChannel } from './channel';
import { INSTALL_SCRIPT } from './install-script';
import { isChannelLocator, mintPairingCode } from '../../protocol/pairingCode';

export { PairingChannel };

/** Minimal shape of the Cloudflare Rate Limiting binding we depend on. */
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  PAIRING_CHANNEL: DurableObjectNamespace;
  /** Per-IP throttle on connections that name an existing channel (`code` /
   *  `claim`). Optional so local dev / tests without the binding still run —
   *  absent means fail-open. */
  PAIR_LIMITER?: RateLimiter;
  /** Per-IP throttle on the mint path, in its own namespace so a flood of
   *  anonymous upgrades cannot spend the budget a real phone needs to pair.
   *  Optional on the same fail-open terms as PAIR_LIMITER. */
  MINT_LIMITER?: RateLimiter;
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

    // Anything naming a channel must look like a code before it costs us
    // anything. `idFromName` on arbitrary input spins up a real Durable Object
    // per distinct string, so an unvalidated locator is a free way to make us
    // allocate storage; a regex is the cheapest possible gate.
    const locator = code ?? claim;
    if (locator !== null && !isChannelLocator(locator)) {
      return new Response('Invalid pairing code', { status: 400 });
    }

    // Throttle every WebSocket-upgrade attempt that reaches this point, by
    // client IP. `code` and `claim` need it because the per-code lockout lives
    // in per-code DO state and cannot see a sweep spread one guess each across
    // many codes. The mint path needs it too: minting is unauthenticated and
    // free, and each attempt persists state in a fresh Durable Object.
    //
    // They draw on separate budgets deliberately. Sharing one would let a flood
    // of anonymous mints exhaust the allowance a phone on the same IP needs to
    // finish pairing — turning a nuisance into a denial of the actual product.
    // Fail-open when the binding is absent (local dev / tests).
    const limiter = locator !== null ? env.PAIR_LIMITER : env.MINT_LIMITER;
    if (limiter) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await limiter.limit({ key: ip });
      if (!success) return new Response('Too many pairing attempts', { status: 429 });
    }

    if (code) {
      // App connecting: route by existing code.
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

    // Connector connecting for the first time: mint a unique code.
    for (let i = 0; i < 5; i++) {
      const newCode = mintPairingCode();
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
