# Summit App Architecture

This is the simple product-and-engineering map for Summit: what exists, how the app connects to an
agent, what pages we have today, and what pages still need to be designed and built.

## Product Shape

Summit is a mobile cockpit for self-hosted AI agents.

It is not a normal chat app. The user already has an agent running somewhere else. Summit gives them
a phone-native way to pair with it, message it, read rich output, see status, and handle blocking
actions like approve or stop.

The main product promise is:

```text
Pair with your agent once, then reach it from your phone anywhere.
```

## Core Frameworks

### Mobile App

- Expo SDK 56
- React Native 0.85
- React 19
- TypeScript
- `expo-router` file-based navigation
- Supabase Auth
- SQLite for local agent/session/message data
- `expo-secure-store` / Keychain for secrets

### Agent Frameworks

Summit is Hermes-first.

Hermes is an inbound API server. It exposes local endpoints like:

```text
GET /v1/capabilities
POST /v1/chat/completions
POST /v1/runs/{id}/approval
POST /v1/runs/{id}/stop
```

OpenClaw is later-stage work and must not be treated as Hermes-compatible without a fresh research
pass.

### Relay Infrastructure

Relay mode uses three pieces:

```text
Summit app -> Summit relay -> connector -> Hermes
```

- `relay.summitapp.dev`: WebSocket relay.
- `get.summitapp.dev/connect`: connector installer.
- Connector: small background process running next to Hermes.

The connector talks to Hermes locally on the server:

```text
localhost:8642
```

Hermes does not need to be exposed publicly in relay mode.

## Connection Modes

### Relay Mode

This is the primary product path.

First-time setup:

```text
1. User opens Summit.
2. User copies the agent install prompt.
3. User pastes it into Hermes or runs the command manually.
4. Connector installs beside Hermes and connects outward to the relay.
5. Connector prints a 6-digit code.
6. User enters the code in Summit.
7. App and connector are paired.
8. User lands in chat.
```

Normal messaging:

```text
App -> Relay -> Connector -> Hermes -> Connector -> Relay -> App
```

The Hermes API key stays on the server. The phone stores only the relay pairing secret/token.

### Direct Mode

This is the advanced fallback.

```text
App -> reachable Hermes host
```

The user enters a host and API key. This only works if the user has made Hermes reachable through
LAN, Tailscale, Cloudflare Tunnel, ngrok, a public domain, or similar.

Direct mode is useful for development and no-middleman users, but it is not the default product
experience.

## App Route Map

Routes live under `src/app`.

```text
src/app/_layout.tsx
  AuthProvider
  AgentProvider
  RouteGuard

src/app/(auth)
  sign-in
  sign-up

src/app/(app)
  pair
  connect
  index
  cron
  settings
```

The root guard handles accounts:

```text
No Supabase session -> /(auth)/sign-in
Has Supabase session -> /(app)
```

The app guard handles agent setup:

```text
No active agent -> /(app)/pair
Active agent -> /(app)/index
```

## Current Pages

### Sign In

Route:

```text
/(auth)/sign-in
```

Purpose:

Authenticate an existing user with Supabase email/password.

Current state:

- Built.
- Email/password sign-in exists.
- Links to sign-up only when `SIGNUP_ENABLED` is true.

Needs:

- Better production error copy.
- Password reset flow.
- Apple/Google sign-in entry points if accounts remain required for MVP.

### Sign Up

Route:

```text
/(auth)/sign-up
```

Purpose:

Create a Summit account.

Current state:

- Built as a dev/self-serve route.
- Email sign-up exists.
- Apple sign-in code exists.
- Production self-serve signup is gated off by `SIGNUP_ENABLED`.

Needs:

- Decide invite-only vs. self-serve production signup.
- Finish Google sign-in if required.
- Add account confirmation and callback polish.

### Pair Agent

Route:

```text
/(app)/pair
```

Purpose:

Primary onboarding path. Pair the phone with a connector using a 6-digit code.

Current state:

- Built.
- Shows copyable agent prompt.
- Shows copyable terminal command.
- Accepts 6-digit code.
- Creates a relay agent record.

Needs:

- Better WebSocket error handling.
- Show specific states: connecting, code expired, code rejected, relay unreachable.
- Show which relay URL/environment is being used in development.
- Add retry/restart connector guidance.
- Keep direct mode as a clearly secondary escape hatch.

### Direct Connect

Route:

```text
/(app)/connect
```

Purpose:

Advanced direct-mode connection using host + API key.

Current state:

- Built.
- Probes Hermes capabilities.
- Stores secret in Keychain.
- Useful for LAN, Tailscale, tunnels, and dev.

Needs:

- Keep as advanced mode.
- Do not let it become the headline onboarding path.
- Add clearer copy that direct mode requires a reachable Hermes endpoint.

### Chat

Route:

```text
/(app)/index
```

Purpose:

Main agent cockpit: message composer, streaming replies, rich markdown, status, and actions.

Current state:

- Built visually.
- Uses active agent and adapter.
- Restores recent session data.
- Streams agent replies.
- Has rich agent message components.
- Sidebar still has seeded/history work remaining.

Needs:

- Make relay chat path reliable end to end.
- Replace remaining seed sidebar data with stored sessions.
- Improve status states: idle, running, blocked, error, disconnected.
- Wire approve/stop to real Hermes capability flags and Runs API.
- Improve disconnected/reconnect behavior.
- Add copy/share actions for useful output.

### Cron Drops

Route:

```text
/(app)/cron
```

Purpose:

View scheduled agent jobs and their recent run output.

Current state:

- Built visually.
- Loads real jobs through the active agent adapter.
- Direct Hermes calls `/api/jobs`.
- Relay mode currently shows "not available" until job frames are added to the relay.
- Pause/resume/run-now call documented Hermes jobs endpoints in direct mode.

Needs:

- Decide whether Cron Drops is in MVP.
- If MVP over relay: add job frames to the relay and connector.
- If not MVP: hide from production navigation for relay-first users.
- Add empty/error/loading states.

### Settings

Route:

```text
/(app)/settings
```

Purpose:

Manage account, agent connection, app data, and privacy controls.

Current state:

- Placeholder only.

Needs:

- Sign out.
- Show active account.
- Show active agent.
- Re-pair agent.
- Remove agent.
- Retest connection.
- Edit direct-mode host/key.
- Delete local data.
- Show app version/build.
- Show privacy/support links.

## New Pages To Design And Build

### Pairing Diagnostics

Route suggestion:

```text
/(app)/pair-diagnostics
```

Purpose:

Help debug pairing without using vague "WebSocket error" messages.

Should show:

- Relay URL.
- App WebSocket status.
- Pairing code status.
- Last relay error.
- Connector seen/not seen if relay exposes it.
- Simple next step: retry, rerun connector, or switch to direct mode.

This can also be a hidden dev/debug page first.

### Connection Detail

Route suggestion:

```text
/(app)/connection
```

Purpose:

A settings subpage for the current agent connection.

Should show:

- Agent name.
- Framework: Hermes/OpenClaw later.
- Transport: relay or direct.
- Capabilities.
- Last connected time.
- Reconnect/retest button.
- Remove agent button.
- Direct-mode edit form when applicable.

### Account Settings

Route suggestion:

```text
/(app)/account
```

Purpose:

Supabase account management.

Should show:

- Email/provider.
- Sign out.
- Delete account or support path.
- Subscription state later if RevenueCat is added.

### Agent Actions / Approvals

Route suggestion:

```text
/(app)/actions
```

Purpose:

A focused queue of blocking decisions.

Should show:

- Pending approvals.
- Running tasks.
- Stop buttons.
- Approve/reject buttons.
- Agent status.

This may start inside Chat before becoming its own page.

### Agent History / Sessions

Route suggestion:

```text
/(app)/history
```

Purpose:

Browse previous conversations and reopen a session.

Should show:

- Session list.
- Last message preview.
- Updated time.
- Delete session.
- Search later.

The current chat sidebar can cover this on large screens; a page may be cleaner on small phones.

### Markdown File Reader

Route suggestion:

```text
/(app)/reader
```

Purpose:

Open rich agent-produced markdown files or long outputs.

Current code already has `MdReader`; decide whether it stays as an in-screen overlay or becomes a
route.

Should support:

- Headings.
- Tables.
- Code blocks.
- Frontmatter.
- Copy.
- Close/back.

### Support / About

Route suggestion:

```text
/(app)/about
```

Purpose:

Small production support page.

Should include:

- Version/build.
- Privacy policy link.
- Terms link.
- Support contact.
- Open-source/self-host relay info later.

## Navigation Principles

The app should feel like a cockpit, not a social messenger.

Primary flow:

```text
Sign in -> Pair -> Chat
```

Secondary flows:

```text
Chat -> Settings
Chat -> Cron Drops, if kept
Chat -> History/sidebar
Settings -> Connection detail
Settings -> Account
```

Do not add tabs unless the product truly has multiple daily surfaces. For now, keep Chat as the
center of gravity.

## State And Storage

### Supabase

Supabase owns account authentication.

The app uses Supabase session state to decide whether the user is in auth routes or app routes.

### AgentProvider

`AgentProvider` owns the active local agent registry.

It loads agents from local storage, tracks the active agent, and creates adapters for each agent.

### Keychain

Secrets go into `expo-secure-store`.

Examples:

- Direct-mode Hermes API key.
- Relay pairing/device token.

Secrets do not belong in SQLite.

### SQLite

SQLite stores local metadata and history.

Examples:

- Agent records.
- Active agent id.
- Chat sessions.
- Messages.

## Adapter Layer

The UI should not know Hermes-specific endpoint details.

The adapter layer decides how to talk to the active agent:

```text
UI -> AgentAdapter -> direct Hermes or relay Hermes
```

Current adapters:

- Hermes direct adapter.
- Relay adapter/client.
- OpenClaw stub.

Rule:

Keep framework-specific logic behind adapters. Do not scatter Hermes endpoint assumptions through UI
screens.

## Design System Summary

Summit is dark-first, quiet, and technical.

Use tokens from:

```text
src/theme.ts
```

Do not use raw colors or random spacing in screens.

### Core Colors

- `colors.bg`: app background.
- `colors.surface`: inputs, panels, user bubble.
- `colors.ink`: primary text and primary light button fill.
- `colors.muted`: secondary text.
- `colors.line`: subtle borders.
- `colors.accent`: links, focus states, running status.
- `colors.error`: errors.

### Type

- `typography.title`: screen title.
- `typography.h`: section heading or markdown heading.
- `typography.body`: normal text and messages.
- `typography.small`: secondary text.
- `typography.caption`: metadata/status.
- `typography.mono`: code only.

### Spacing

Use:

```text
space.xs, space.sm, space.md, space.lg, space.xl, space.xxl
```

Use `screenPadding` for main page horizontal padding.

### Component Feel

- User messages: right bubble.
- Agent messages: full-width, no bubble.
- Inputs: dark filled surface with subtle border.
- Primary actions: light button using `colors.ink`.
- Accent: use sparingly.
- Errors: specific and plain.
- No marketing-style hero sections inside the app.
- No decorative gradients or noisy UI.

## Build Priorities

### Priority 1: Pairing Reliability

- Fix WebSocket errors.
- Make relay URL/environment obvious in dev.
- Show specific pairing errors.
- Confirm app and connector use the same relay.

### Priority 2: Relay Chat End To End

- Pair app.
- Send one message.
- Stream real Hermes reply.
- Persist the conversation.

### Priority 3: Settings And Recovery

- Sign out.
- Remove/re-pair agent.
- Retest connection.
- Delete local data.
- See connection status.

### Priority 4: Production Surface Cleanup

- Hide Cron Drops for relay-first users until relay job frames are wired.
- Replace seeded sidebar/history.
- Add complete empty/error/loading states.
- Add support/about/privacy links.

## Simple Mental Model

Summit has three layers:

```text
Pages
  What the user sees: sign in, pair, chat, settings.

Agent layer
  Stores agents, secrets, sessions, and chooses the right adapter.

Connection layer
  Direct Hermes calls or relay WebSocket frames through the connector.
```

When building anything new, ask:

```text
Does this help the user pair, talk to their agent, understand status, or take action?
```

If not, it probably belongs later.
