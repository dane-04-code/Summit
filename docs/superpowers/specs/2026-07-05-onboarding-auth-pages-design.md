# Onboarding & Auth Pages — Design

**Date:** 2026-07-05
**Status:** Approved (built autonomously at Dane's request — "plan, build, implement the full onboarding flow")

## Goal

Give Summit a first-open experience with real presence — closer to the polish of top-tier
SaaS/dev-tool apps (Vercel, Linear) — without breaking the product's quiet, dark, minimal
design system. Today a signed-out user is dropped straight onto a bare sign-in form; the
sign-up page is structurally good but uses a wrong brand glyph, and there is no landing
moment at all.

## Flow

```
signed out ──▶ /(auth)/welcome ── Get started ──▶ /(auth)/sign-up ──▶ session
                     │                                                  │
                     └── Sign in ──▶ /(auth)/sign-in ──────────────────┘
                                                                        ▼
                                                  RouteGuard → /(app) → AgentGuard → /pair
```

Three screens before pairing. The pair screen already handles "paste this prompt → enter
the 6-digit code" and the no-agent guard already lands new users there — it is **not
modified** by this work.

When `SIGNUP_ENABLED` is false (production), Welcome's primary CTA goes to sign-in
instead of sign-up, and the sign-up footer link is hidden (existing behaviour preserved).

## Screens

### 1. Welcome — `src/app/(auth)/welcome.tsx` (new)

- **Hero (upper half):** `logo-glow.png` as a soft accent backdrop behind a new
  mountain-peak Λ mark (SVG, recreated from the app icon), the "Summit" wordmark
  (`typography.title`, tightened letter-spacing), and a one-line tagline:
  *"Your agent, in your pocket."*
- **Feature pager (middle):** horizontally paging swipe strip with 4 cards + pagination
  dots (active dot = `accent`). Cards are icon + heading + two lines, framework-agnostic:
  1. **Talk to it anywhere** — a real chat with your self-hosted agent, wherever you are.
  2. **Watch it work** — replies stream in live, with proper markdown and code.
  3. **Stay in control** — approve or stop runs from your phone the moment it asks.
  4. **Private by design** — keys stay in your keychain; messages go only to your server.
- **CTA stack (bottom):** primary button (light `ink` fill, per design system — not
  accent) "Get started" → sign-up; quiet text link "I already have an account" → sign-in.
- **Motion:** single gentle fade-up on mount using core RN `Animated` (not Reanimated —
  keeps tests dependency-free and matches the restrained aesthetic). Pager dots update on
  `onMomentumScrollEnd`.

### 2. Sign in — `src/app/(auth)/sign-in.tsx` (rebuilt UI, same logic)

Mirrors the sign-up page's structure: brand mark, "Welcome back" title, subtitle,
labeled inputs with focus states, password visibility toggle, `Continue with Apple`
(same `signInWithIdToken` call — works for sign-in identically), error line, footer
link to sign-up (gated on `SIGNUP_ENABLED`). Supabase calls unchanged. No password
reset link — no reset flow exists yet (YAGNI).

### 3. Sign up — `src/app/(auth)/sign-up.tsx` (touch-up only)

- Replace the local person-glyph `BrandMark` with the shared peak mark.
- Copy: subtitle references the flow ("Chat with your agent from anywhere.").
- Everything else (Apple, confirm-email state, focus states) stays.

## Shared component

`src/ui/BrandMark.tsx` — exports:
- `PeakGlyph` — the rounded-Λ SVG path, size + color props.
- `BrandMark` — the glyph in the existing rounded-square `ink` tile (as sign-up has now).

Used by welcome, sign-in, sign-up.

## Routing change

`src/app/_layout.tsx` `RouteGuard`: unauthenticated redirect target changes from
`/(auth)/sign-in` to `/(auth)/welcome`. Signed-in redirect unchanged. Welcome, being in
the `(auth)` group, needs no guard changes.

## Testing

- `__tests__/auth/welcome.test.tsx` — renders hero + all four feature cards; primary CTA
  navigates to sign-up when signup enabled; "already have an account" navigates to
  sign-in. (Async `render` per repo convention.)
- `__tests__/auth/signIn.test.tsx` — renders rebuilt structure; submit calls
  `supabase.auth.signInWithPassword`; error message surfaces.
- Green bar: `npx tsc --noEmit` + `npm test`.

## Out of scope

- Pair/connect screens (already built and recently reworked).
- Password reset, email-change, other auth flows.
- Light mode, custom fonts, Lottie/video — against the design system.
