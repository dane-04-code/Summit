import { describe, it, expect, vi } from 'vitest';
import worker, { type Env } from '../index';

// A valid-shaped 8-char pairing code (Crockford base32, see protocol/pairingCode.ts),
// reused from logic.test.ts's fixtures.
const CODE = 'K7M29XQP';

function makeLimiter(success: boolean) {
  return { limit: vi.fn(async () => ({ success })) };
}

function makeLimiters(pair = true, mint = true) {
  return { PAIR_LIMITER: makeLimiter(pair), MINT_LIMITER: makeLimiter(mint) };
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  const stub = { fetch: vi.fn(async () => new Response('ok', { status: 200 })) };
  return {
    PAIRING_CHANNEL: {
      idFromName: (name: string) => name,
      get: () => stub,
    } as unknown as Env['PAIRING_CHANNEL'],
    ...overrides,
  } as Env;
}

function wsRequest(query = '') {
  return new Request(`https://relay.summitapp.dev/${query}`, {
    headers: { Upgrade: 'websocket' },
  });
}

describe('mint-new-code path (no code, no claim)', () => {
  it('is throttled, drawing on MINT_LIMITER rather than the pairing budget', async () => {
    const { PAIR_LIMITER, MINT_LIMITER } = makeLimiters();
    const env = makeEnv({ PAIR_LIMITER, MINT_LIMITER } as Partial<Env>);

    await worker.fetch(wsRequest(), env);

    expect(MINT_LIMITER.limit).toHaveBeenCalledTimes(1);
    expect(PAIR_LIMITER.limit).not.toHaveBeenCalled();
  });

  it('is denied with 429 when the limiter reports failure', async () => {
    const env = makeEnv({ MINT_LIMITER: makeLimiter(false) as any });

    const res = await worker.fetch(wsRequest(), env);

    expect(res.status).toBe(429);
  });

  it('still succeeds for a normal single first-connect when the limiter allows it', async () => {
    const env = makeEnv({ MINT_LIMITER: makeLimiter(true) as any });

    const res = await worker.fetch(wsRequest(), env);

    expect(res.status).toBe(200);
  });

  it('fails open when the limiter binding is absent (local dev / tests)', async () => {
    const env = makeEnv();

    const res = await worker.fetch(wsRequest(), env);

    expect(res.status).toBe(200);
  });
});

describe('the two budgets are independent', () => {
  // The reason for two namespaces: a mint flood must not be able to spend the
  // allowance a phone on the same IP needs to finish pairing.
  it('lets a phone pair while the mint budget is exhausted', async () => {
    const env = makeEnv({
      PAIR_LIMITER: makeLimiter(true),
      MINT_LIMITER: makeLimiter(false),
    } as Partial<Env>);

    expect((await worker.fetch(wsRequest(), env)).status).toBe(429);
    expect((await worker.fetch(wsRequest(`?code=${CODE}`), env)).status).toBe(200);
  });

  it('still blocks a mint when only the pairing budget is exhausted', async () => {
    const env = makeEnv({
      PAIR_LIMITER: makeLimiter(false),
      MINT_LIMITER: makeLimiter(true),
    } as Partial<Env>);

    expect((await worker.fetch(wsRequest(`?code=${CODE}`), env)).status).toBe(429);
    expect((await worker.fetch(wsRequest(), env)).status).toBe(200);
  });
});

describe('code and claim paths (regression)', () => {
  it('still rate-limits and routes the code path', async () => {
    const { PAIR_LIMITER, MINT_LIMITER } = makeLimiters();
    const env = makeEnv({ PAIR_LIMITER, MINT_LIMITER } as Partial<Env>);

    const res = await worker.fetch(wsRequest(`?code=${CODE}`), env);

    expect(PAIR_LIMITER.limit).toHaveBeenCalledTimes(1);
    expect(MINT_LIMITER.limit).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('still returns 429 for the code path when the limiter denies it', async () => {
    const env = makeEnv({ PAIR_LIMITER: makeLimiter(false) as any });

    const res = await worker.fetch(wsRequest(`?code=${CODE}`), env);

    expect(res.status).toBe(429);
  });

  it('still rate-limits and routes the claim path', async () => {
    const { PAIR_LIMITER, MINT_LIMITER } = makeLimiters();
    const env = makeEnv({ PAIR_LIMITER, MINT_LIMITER } as Partial<Env>);

    const res = await worker.fetch(wsRequest(`?claim=${CODE}`), env);

    expect(PAIR_LIMITER.limit).toHaveBeenCalledTimes(1);
    expect(MINT_LIMITER.limit).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('rejects a malformed locator before touching either limiter', async () => {
    const { PAIR_LIMITER, MINT_LIMITER } = makeLimiters();
    const env = makeEnv({ PAIR_LIMITER, MINT_LIMITER } as Partial<Env>);

    const res = await worker.fetch(wsRequest('?code=not-a-valid-code'), env);

    expect(res.status).toBe(400);
    expect(PAIR_LIMITER.limit).not.toHaveBeenCalled();
    expect(MINT_LIMITER.limit).not.toHaveBeenCalled();
  });
});

describe('non-websocket requests', () => {
  it('returns a plain 200 without touching either limiter', async () => {
    const { PAIR_LIMITER, MINT_LIMITER } = makeLimiters();
    const env = makeEnv({ PAIR_LIMITER, MINT_LIMITER } as Partial<Env>);

    const res = await worker.fetch(new Request('https://relay.summitapp.dev/'), env);

    expect(res.status).toBe(200);
    expect(PAIR_LIMITER.limit).not.toHaveBeenCalled();
    expect(MINT_LIMITER.limit).not.toHaveBeenCalled();
  });
});
