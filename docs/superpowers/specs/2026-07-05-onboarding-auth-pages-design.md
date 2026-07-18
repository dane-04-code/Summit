# Onboarding & Auth Pages — Design

**Date:** 2026-07-05
**Status:** Superseded in part on 2026-07-18 (welcome screen redesigned; auth forms unchanged)

## Goal

Give Summit a first-open experience with real presence — closer to the polish of top-tier
SaaS/dev-tool apps (Vercel, Linear) — without breaking the product's quiet, dark, minimal
design system. Today a signed-out user is dropped straight onto a bare sign-in form; the
sign-up page is structurally good but uses a wrong brand glyph, and there is no landing
moment at all.

## Flow

```
signed out ──▶ /(auth)/welcome ── Connect your agent ──▶ /(auth)/sign-up ──▶ session
                     │                                                  │
                     └── Sign in ──▶ /(auth)/sign-in ──────────────────┘
                                                                        ▼
                                                  RouteGuard → /(app) → AgentGuard → /pair
```

Three screens before pairing. The pair screen already handles "paste this prompt → enter
the 6-digit code" and the no-agent guard already lands new users there — it is **not
modified** by this work.

Self-serve signup is enabled in production and beta builds. Welcome's primary CTA routes to sign-up,
and sign-in always includes the create-account route.

## Screens

### 1. Welcome — `src/app/(auth)/welcome.tsx` (redesigned 2026-07-18)

- **Header:** the real transparent Summit image mark + wordmark, with a direct sign-in action.
- **Hero:** left-aligned, flow-led promise: *"Stay close to the work."* No blue glow or decorative
  background.
- **Product preview:** one compact operator-cockpit card showing connection status, a completed run,
  and the signature approval moment. This explains the product in one glance instead of four slides.
- **CTA stack:** a single light "Connect your agent" action plus a precise key-location reassurance.
- **Motion:** none. The screen is static, immediately scannable, and has no paging gesture.

### 2. Sign in — `src/app/(auth)/sign-in.tsx` (rebuilt UI, same logic)

Mirrors the sign-up page's structure: brand mark, "Welcome back" title, subtitle,
labeled inputs with focus states, password visibility toggle, `Continue with Apple`
(same `signInWithIdToken` call — works for sign-in identically), error line, footer
link to sign-up. The scroll view uses native iOS keyboard insets rather than resizing the whole
screen, so focusing an input does not collapse and jump the brand area. Supabase calls unchanged.
No password reset link — no reset flow exists yet (YAGNI).

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

- `__tests__/auth/welcome.test.tsx` — renders the hero and operator-cockpit preview; the primary CTA
  navigates to sign-up when signup is enabled; the header sign-in action navigates to sign-in.
  (Async `render` per repo convention.)
- `__tests__/auth/signIn.test.tsx` — renders rebuilt structure; submit calls
  `supabase.auth.signInWithPassword`; error message surfaces.
- Green bar: `npx tsc --noEmit` + `npm test`.

## Out of scope

- Pair/connect screens (already built and recently reworked).
- Password reset, email-change, other auth flows.
- Light mode, custom fonts, Lottie/video — against the design system.
