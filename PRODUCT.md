# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Primary: technical self-hosters running personal or business AI agents on Hermes or OpenClaw,
active in r/openclaw and the Hermes/OpenClaw Discord communities. Comfortable setting up API
servers, bearer tokens, and self-hosted infrastructure.

Within that base, the primary brand target is the earlier-stage segment: people who already run a
personal-assistant-style agent day to day and currently message it through a raw Telegram bot
bridge. They're tired of Telegram as the interface, not looking for a deeper self-hosting project.
They're comfortable with pairing/connecting an app explained plainly, but not with tunnels, relays,
and sidecars as background knowledge.

Not targeting: mainstream consumers (no agent to connect to), Matrix/E2EE maximalists, or
enterprise/team buyers (not in v1).

## Product Purpose

Summit is a mobile client for self-hosted AI agent frameworks (Hermes, OpenClaw). It gives users a
clean interface to monitor, chat with, and act on their agents from anywhere, fixing specific
problems with the Telegram/Discord bot workaround: no clean way to act on blocking approve/stop
decisions, no real status (idle/running/error), and mangled markdown output (tables, headings, code
blocks rendering as unreadable plain text).

Success means the whole flow — pairing, messaging, seeing status, acting on the agent — feels like a
first-class app instead of a degraded chat bot.

## Positioning

"The mobile client your AI agent deserves — reach it from anywhere and work with it like a real app,
not a degraded chat bot." Summit sells the *flow*, not any single feature. Proper markdown rendering
is the most visible upgrade over a raw Telegram bot, but the differentiator is the whole experience
feeling first-class: pair in seconds, message smoothly, see status, act with one tap.

Brand promise: your agent stays reachable, readable, and under control.

## Operating Context

- Users pair the app with a connector sidecar running next to their self-hosted Hermes/OpenClaw
  instance, via a 6-digit pairing code (relay-first connection model, Telegram-shaped: connector
  dials out to a relay, no exposed server or host URL needed, works off local network/on cellular).
- A direct host+key mode exists as an advanced option for Tailscale / no-middleman users, but is not
  the primary MVP path.
- Users act on the agent from their phone away from their desktop: reading chat/output, monitoring
  run status, approving or stopping blocking actions, receiving push notifications for proactive/cron
  agent activity.

## Capabilities and Constraints

- React Native (Expo SDK 56, RN 0.85, React 19) app, iOS first, Android to follow.
- Accounts via Auth0 (current auth provider as of 2026-07-29; wired app-side but not yet verified on
  a real device — treat as unproven until device-tested).
- Relay is mandatory for the MVP path; the relay and a native Hermes platform plugin are built and
  operating reliably in active testing (per CLAUDE.md's delivery-status override). The Go connector
  is a compatibility fallback, not the only Hermes integration path.
- Current V1 focus: mobile chat/output polish, plus real-device proof of recovery, push, and
  proactive cron delivery.
- Multi-agent support exists (generic OpenAI adapter, auto-detect, capability-gated UI) alongside the
  Hermes/OpenClaw-first framing.

## Brand Commitments

- Product name: **Summit**. Avoid the older name "Agent Messenger" except for legacy code, bundle
  identifiers, or historical filenames.
- One-line description: "The mobile cockpit for your self-hosted AI agent."
- UI direction: dark by default — clean, calm, premium, not white/stark. One restrained accent,
  system font, generous spacing. Full tokens in `DESIGN_SYSTEM.md`. Light mode is a possible later
  option, not the product's current look.
- No onboarding scaffolding: Summit is "just a chat" like Telegram — no tutorials, example prompts,
  or overlays.
- Radically clean, minimal, "invisible" UI is the design goal — resist distinctive-design urges that
  would make the interface feel designed-at-you rather than disappearing into the flow.

## Evidence on Hand

No real customer testimonials, case studies, press, or usage benchmarks on hand yet — do not
fabricate any. Product is in active private-beta testing (per CLAUDE.md's delivery-status override,
last updated 2026-07-21); relay stack and pairing are validated in testing, but device-verified
proof of recovery/push/cron delivery is still in progress as of 2026-08-01.

## Product Principles

- Sell the flow, not a feature. Weigh every design/feature decision by whether it makes the flow more
  fluent, not by whether it's a novel capability.
- Match Telegram's ease of setup (pairing, no exposed server) while beating it on chat/output quality
  and control (approve/stop, real status).
- Keep the UI invisible and calm — no onboarding scaffolding, no distinctive-design flourishes for
  their own sake.
- Preserve dark-by-default, restrained-accent visual identity as the product's current look.
- Be honest about what's device-verified vs. built-but-unproven (auth, push, recovery) — don't let
  design or marketing claims outrun real device evidence.
