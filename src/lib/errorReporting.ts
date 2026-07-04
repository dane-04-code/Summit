/**
 * Error reporting — the eyes on failure.
 *
 * Built on the same dependency-free HTTP pattern as analytics (`src/lib/
 * analytics.tsx`): a fire-and-forget POST to PostHog's capture endpoint,
 * disabled until `EXPO_PUBLIC_POSTHOG_KEY` is present. Errors are sent as
 * `$exception` events so they land in PostHog's error tracking, grouped and
 * queryable.
 *
 * Two hard rules, because a reporter that misbehaves is worse than none:
 *   1. It must never throw — not on circular input, not on a broken fetch.
 *   2. It must never change app behavior — every failure is swallowed.
 */

import { POSTHOG_KEY, POSTHOG_HOST } from '@/config';

/** Where an error came from, plus a few dimensions worth slicing on. */
export type ErrorContext = Partial<{
  where: string;
  fatal: boolean;
  transport: 'direct' | 'relay';
  framework: string;
}>;

// Stable id for a single app run, used until (and after) a user is known — so
// anonymous errors still cluster by session instead of scattering per-event.
const sessionDistinctId = `summit-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
let currentUserId: string | null = null;

/** Attribute subsequent reports to a user; pass null on sign-out. */
export function setErrorUser(userId: string | null): void {
  currentUserId = userId;
}

function normalizeError(error: unknown): { type: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      type: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack,
    };
  }
  if (typeof error === 'string') return { type: 'Error', message: error };
  try {
    return { type: 'Error', message: JSON.stringify(error) };
  } catch {
    // Circular or otherwise unserializable — fall back to a coarse string.
    return { type: 'Error', message: String(error) };
  }
}

/** Report an error. Safe to call from anywhere, including catch blocks. */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  if (!POSTHOG_KEY) return;
  try {
    const { type, message, stack } = normalizeError(error);
    void Promise.resolve(
      fetch(`${POSTHOG_HOST.replace(/\/+$/, '')}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: POSTHOG_KEY,
          event: '$exception',
          distinct_id: currentUserId ?? sessionDistinctId,
          properties: {
            $exception_list: [
              {
                type,
                value: message,
                mechanism: { handled: !context.fatal, synthetic: false },
              },
            ],
            $exception_type: type,
            $exception_message: message,
            $exception_stack_trace_raw: stack,
            where: context.where,
            fatal: context.fatal ?? false,
            transport: context.transport,
            framework: context.framework,
            source: 'summit_mobile',
          },
        }),
      }),
    ).catch(() => {
      // Reporting must never affect app behavior — including its own failures.
    });
  } catch {
    // Even building the payload must not throw into the caller.
  }
}

type GlobalErrorUtils = {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

/**
 * Route React Native's uncaught JS errors through the reporter, then hand off
 * to the platform's own handler (the dev red screen, the release crash path)
 * so nothing that happens today stops happening.
 */
export function installGlobalErrorHandlers(): void {
  const errorUtils = (globalThis as unknown as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    captureError(error, { where: 'uncaught', fatal: !!isFatal });
    previous?.(error, isFatal);
  });
}
