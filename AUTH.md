   # Auth Setup

Supabase Auth with Apple Sign-In, Google Sign-In, and email/password.

## Supabase Project

- **URL:** `https://trgwyamvawrqfdgtjgcz.supabase.co`
- **Anon key:** in `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Providers Configured

| Provider | Status | Notes |
|----------|--------|-------|
| Email/password | ✅ | Confirm email on signup |
| Apple Sign-In | ✅ | Service ID: `com.dane.agentmessenger.siwa`, Team: `WT9ZUR8B9B`, Key: `7XUPK4U4B8` |
| Google | ✅ | Web OAuth client, callback to Supabase |

**Supabase callback URL (all providers):** `https://trgwyamvawrqfdgtjgcz.supabase.co/auth/v1/callback`

## Code Structure

```
src/
  lib/supabase.ts          # Supabase client — SecureStore session adapter
  context/AuthContext.tsx  # Session state, useAuth() hook, signOut
  app/
    _layout.tsx            # AuthProvider + RouteGuard (redirects on auth state)
    (auth)/
      _layout.tsx          # No-header layout for auth screens
      sign-in.tsx          # Email sign-in (Apple + Google buttons TBD in Tasks 5/6)
      sign-up.tsx          # Email registration + confirmation screen
    (app)/
      _layout.tsx          # Protected layout
      index.tsx            # Chat screen (requires session)
      settings.tsx         # Settings (requires session)
```

## How Auth Flow Works

1. App loads → `RouteGuard` checks session
2. No session → redirect to `/(auth)/sign-in`
3. Sign-in succeeds → Supabase fires `onAuthStateChange` → `RouteGuard` redirects to `/(app)/`
4. Session persisted in iOS Keychain via `expo-secure-store`
5. Sign-out → session cleared → `RouteGuard` redirects back to sign-in

## Apple Secret Expiry

The Apple client secret JWT **expires 180 days from generation (2026-12-24)**. Regenerate with:

```bash
node generate-apple-secret.js   # (recreate from docs/superpowers/plans/2026-06-27-supabase-auth.md)
```

Then paste the new JWT into **Supabase → Auth → Providers → Apple → Secret Key**.

## Still To Build (Tasks 5 & 6)

- Apple Sign-In button wired up in `sign-in.tsx`
- Google Sign-In button + OAuth browser flow + `src/app/auth/callback.tsx`
