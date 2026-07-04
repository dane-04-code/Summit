/**
 * Error reporting must be invisible when unconfigured, attributable when it
 * can be, and above all it must never throw — a reporter that crashes the app
 * it's meant to watch is worse than none.
 */

type Reporter = typeof import('@/lib/errorReporting');

const POSTHOG_HOST = 'https://ph.test';

function load(key: string): Reporter {
  jest.resetModules();
  jest.doMock('@/config', () => ({ POSTHOG_KEY: key, POSTHOG_HOST }));
  return require('@/lib/errorReporting') as Reporter;
}

/** The single most recent capture body, parsed. */
function lastBody(fetchMock: jest.Mock): any {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return JSON.parse(call[1].body);
}

describe('captureError', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;
  });

  it('posts a $exception event to the PostHog capture endpoint when a key is set', () => {
    const { captureError } = load('test-key');
    captureError(new Error('boom'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${POSTHOG_HOST}/capture/`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.api_key).toBe('test-key');
    expect(body.event).toBe('$exception');
  });

  it('does nothing — no network — when no key is configured', () => {
    const { captureError } = load('');
    captureError(new Error('boom'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('captures the error type, message, and stack from a thrown Error', () => {
    const { captureError } = load('test-key');
    const err = new TypeError('bad value');
    captureError(err);

    const props = lastBody(fetchMock).properties;
    expect(props.$exception_type).toBe('TypeError');
    expect(props.$exception_message).toBe('bad value');
    expect(props.$exception_stack_trace_raw).toContain('bad value');
    expect(props.$exception_list[0]).toMatchObject({ type: 'TypeError', value: 'bad value' });
  });

  it('normalizes a non-Error value into a reportable message', () => {
    const { captureError } = load('test-key');
    captureError('something failed as a string');
    const props = lastBody(fetchMock).properties;
    expect(props.$exception_message).toBe('something failed as a string');
  });

  it('records the call site and marks fatality via the mechanism handled flag', () => {
    const { captureError } = load('test-key');
    captureError(new Error('down'), { where: 'relay_reconnect', fatal: true });
    const props = lastBody(fetchMock).properties;
    expect(props.where).toBe('relay_reconnect');
    expect(props.fatal).toBe(true);
    expect(props.$exception_list[0].mechanism.handled).toBe(false);
  });

  it('attributes to the signed-in user once set, and to a stable session id before that', () => {
    const { captureError, setErrorUser } = load('test-key');

    captureError(new Error('anon'));
    const anon = lastBody(fetchMock).distinct_id;
    expect(typeof anon).toBe('string');
    expect(anon.length).toBeGreaterThan(0);

    setErrorUser('user-123');
    captureError(new Error('known'));
    expect(lastBody(fetchMock).distinct_id).toBe('user-123');

    // Signing out returns to the anonymous session id, not a crash.
    setErrorUser(null);
    captureError(new Error('anon again'));
    expect(lastBody(fetchMock).distinct_id).toBe(anon);
  });

  it('never throws, even on circular or nullish input, and even if fetch is broken', () => {
    const { captureError } = load('test-key');
    (globalThis as any).fetch = () => {
      throw new Error('network layer exploded');
    };

    const circular: any = {};
    circular.self = circular;

    expect(() => captureError(circular)).not.toThrow();
    expect(() => captureError(null)).not.toThrow();
    expect(() => captureError(undefined)).not.toThrow();
  });
});

describe('installGlobalErrorHandlers', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;
  });

  it('reports uncaught errors through the RN global handler and preserves the previous handler', () => {
    const previous = jest.fn();
    (globalThis as any).ErrorUtils = {
      _handler: previous,
      getGlobalHandler() {
        return this._handler;
      },
      setGlobalHandler(h: any) {
        this._handler = h;
      },
    };

    const { installGlobalErrorHandlers } = load('test-key');
    installGlobalErrorHandlers();

    const err = new Error('uncaught boom');
    (globalThis as any).ErrorUtils.getGlobalHandler()(err, true);

    // Reported as fatal…
    const props = lastBody(fetchMock).properties;
    expect(props.where).toBe('uncaught');
    expect(props.fatal).toBe(true);
    // …and the platform's own handler still runs (red screen in dev, etc.).
    expect(previous).toHaveBeenCalledWith(err, true);
  });

  it('is a no-op where no global handler exists', () => {
    delete (globalThis as any).ErrorUtils;
    const { installGlobalErrorHandlers } = load('test-key');
    expect(() => installGlobalErrorHandlers()).not.toThrow();
  });
});
