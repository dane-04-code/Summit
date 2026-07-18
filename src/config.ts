/**
 * App-level feature flags.
 *
 * `SIGNUP_ENABLED` — whether self-serve account creation is offered. Summit's
 * beta is open to new accounts, so the option stays available in release builds.
 * Supabase remains the enforcement point for email uniqueness and provider rules.
 */
export const SIGNUP_ENABLED = true;

/**
 * WebSocket base URL for the relay. Pairing code is appended as ?code=NNNNNN.
 * In dev, `wrangler dev` runs locally on 8787.
 */
export const RELAY_WS_URL =
  process.env.EXPO_PUBLIC_RELAY_URL ||
  (__DEV__ ? 'ws://localhost:8787' : 'wss://relay.summitapp.dev');

/**
 * Optional PostHog project settings. Analytics stays disabled until
 * `EXPO_PUBLIC_POSTHOG_KEY` is present.
 */
export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
