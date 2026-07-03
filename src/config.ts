/**
 * App-level feature flags.
 *
 * `SIGNUP_ENABLED` — whether self-serve account creation is offered. Gated to
 * dev builds only (`__DEV__` is false in any release build), so production hides
 * the sign-up link and makes the /sign-up route inert. This is a UI-level gate:
 * for hard enforcement, also disable new signups in the Supabase dashboard
 * (Authentication → Sign In / Providers → "Allow new users to sign up") — note
 * that toggle is project-wide, so it would affect dev too.
 */
export const SIGNUP_ENABLED = __DEV__;

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
