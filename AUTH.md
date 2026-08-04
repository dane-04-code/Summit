# Auth Setup

Clerk (headless — no Clerk-branded UI components), with email/password, Apple, Google, and GitHub.

## Clerk Project

- **Publishable key:** in `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (client-side, safe to expose)
- **Secret key:** set as a Supabase function secret, `CLERK_SECRET_KEY` — used only by the
  `delete-account` Edge Function to verify sessions and delete users via the Clerk Backend API.
  Never ships in the app.

## Providers Configured

Configure these in the Clerk dashboard under **User & Authentication**:

| Provider | Notes |
|----------|-------|
| Email/password | Email verification code (`email_code`) on sign-up |
| Apple | OAuth, `oauth_apple` strategy |
| Google | OAuth, `oauth_google` strategy |
| GitHub | OAuth, `oauth_github` strategy |

## Code Structure

```
src/
  lib/clerk.ts              # Publishable key + SecureStore-backed token cache
  lib/oauth.ts               # Browser warm-up + maybeCompleteAuthSession() for OAuth redirects
  lib/account.ts             # Display helpers reading Clerk's user shape
  context/AuthContext.tsx    # Session state, useAuth() hook, signOut
  app/
    _layout.tsx             # ClerkProvider + AuthProvider + RouteGuard (redirects on auth state)
    (auth)/
      sign-in.tsx            # Email/password fields + OAuth buttons (Clerk headless hooks)
      sign-up.tsx             # Email/password + verification-code step + OAuth buttons
    (app)/
      account.tsx             # Delete-account flow — passes a Clerk session token explicitly
```

## How Auth Flow Works

1. App loads → `RouteGuard` checks session (via `AuthContext`, backed by Clerk's `useUser`/`useAuth`)
2. No session → redirect to `/(auth)/sign-in`
3. Sign-in succeeds → `useUser()`/`useAuth()` update → `RouteGuard` redirects to `/(app)/`
4. Session persisted via Clerk's token cache, backed by `expo-secure-store`
5. Sign-out → session cleared → `RouteGuard` redirects back to sign-in

## Why headless, not Clerk's prebuilt components

Clerk's prebuilt `<SignIn />`/`<SignUp />` components show "Secured by Clerk" branding unless
you're on a paid plan. `sign-in.tsx`/`sign-up.tsx` build their own fields against Clerk's
headless `useSignIn`/`useSignUp`/`useSSO` hooks instead — same free tier, no branding, and the
screens match this app's own design system rather than Clerk's.

## Account Deletion

`supabase/functions/delete-account` deletes the Clerk account (not a Supabase Auth account — this
app never creates one). The client fetches a Clerk session token via `getToken()` and passes it
explicitly in the `Authorization` header, since Supabase's own auto-attached header is for
Supabase Auth sessions this app doesn't have.
