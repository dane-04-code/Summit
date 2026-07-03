# Summit Frontend Pages

This document explains the actual front-end pages in Summit: what each page is for, how it is
structured, what design role it plays, and what still needs to be designed or finished.

Use this as the page-level companion to `docs/APP_ARCHITECTURE.md`.

## Frontend Direction

Summit should feel like a calm technical cockpit.

It is not a social chat app and not a marketing website inside an app. The UI should be quiet,
dark, readable, and practical.

The main user journey is:

```text
Sign in -> Pair agent -> Chat with agent -> Manage connection/settings
```

The app should make the agent feel reachable and controllable, not noisy or decorative.

## Shared Layout Rules

All pages should use:

- Dark background from `colors.bg`.
- System font.
- Theme tokens from `src/theme.ts`.
- `SafeAreaView` for phone-safe layout.
- Clear, specific error messages.
- Minimal borders and cards.
- One obvious primary action per screen.

Avoid:

- Marketing hero layouts.
- Generic chat-app decoration.
- Raw hex colors in page components.
- Feature explanations as visible filler text.
- Seed/demo data in production pages.

## Current Route Groups

```text
src/app/(auth)
  sign-in.tsx
  sign-up.tsx

src/app/(app)
  pair.tsx
  connect.tsx
  index.tsx
  cron.tsx
  settings.tsx
```

## Page: Sign In

Route:

```text
/(auth)/sign-in
```

File:

```text
src/app/(auth)/sign-in.tsx
```

### Purpose

Let an existing user authenticate before entering the app.

### Current Structure

- Centered brand/title area.
- Email input.
- Password input.
- Error text.
- Primary sign-in button.
- Optional sign-up link in development.

### Frontend Design

This page should be sparse and confident. It should not feel like consumer onboarding.

Recommended feel:

```text
Summit
Sign in to continue

[ Email    ]
[ Password ]
[ Sign in  ]
```

Use the dark background, surface inputs, and a light primary button.

### Data / Behavior

- Uses Supabase email/password sign-in.
- On successful session, root route guard moves user into `/(app)`.
- Sign-up link is gated by `SIGNUP_ENABLED`.

### Needs Design/Build

- Password reset entry.
- Production-ready error copy.
- Apple/Google sign-in buttons if they remain part of the account plan.
- Better brand mark once final icon/logo is chosen.

## Page: Sign Up

Route:

```text
/(auth)/sign-up
```

File:

```text
src/app/(auth)/sign-up.tsx
```

### Purpose

Let a new user create an account when self-serve signup is enabled.

### Current Structure

- Brand mark.
- Title/subtitle.
- Name input.
- Email input.
- Password input.
- Apple sign-in support.
- Confirmation state after email signup.

### Frontend Design

This page can be slightly more explanatory than sign-in, but still restrained. It should feel like
joining a technical tool, not signing up for a social network.

Important design rule:

The page should not overpromise. Until relay mode is stable, avoid copy that implies everything is
fully production-ready.

### Data / Behavior

- Uses Supabase email signup.
- Uses Apple identity token on iOS when available.
- Redirects back to sign-in if self-serve signup is disabled.

### Needs Design/Build

- Decide if production uses invite-only or self-serve.
- Add Google sign-in if needed.
- Polish confirmation/callback flow.
- Replace temporary brand mark with final Summit mountain mark.

## Page: Pair Agent

Route:

```text
/(app)/pair
```

File:

```text
src/app/(app)/pair.tsx
```

### Purpose

This is the primary onboarding page.

The user pairs Summit with their agent using a connector and a 6-digit code.

### Current Structure

- Header: "Connect your agent".
- Step 1: copyable prompt to paste into the agent.
- Step 2: copyable terminal command fallback.
- Step 3: 6-digit code input.
- Pair button.
- Advanced direct-mode back/escape path.

### Frontend Design

This page is the most important setup screen.

It should make the connection process feel simple:

```text
1. Give this to your agent.
2. Or run this command yourself.
3. Enter the code.
```

The current step-card structure is right. The next design pass should make it calmer and easier to
debug.

### Data / Behavior

- Uses `RELAY_WS_URL`.
- Creates `RelayClient`.
- Appends `?code=NNNNNN`.
- On success, creates a relay agent in `AgentProvider`.
- Stores the pairing code/secret through the agent secret path.
- Redirects to chat.

### Needs Design/Build

- Replace generic "WebSocket error" with useful messages.
- Show pairing states:
  - waiting
  - connecting
  - paired
  - code expired
  - relay unreachable
  - connector disconnected
- Add a small diagnostics surface for development.
- Make the relay URL visible only in dev/debug mode.
- Add clear guidance to rerun connector if needed.

## Page: Direct Connect

Route:

```text
/(app)/connect
```

File:

```text
src/app/(app)/connect.tsx
```

### Purpose

Advanced fallback for users who want to connect directly to Hermes with a reachable host and API key.

### Current Structure

- Agent name field.
- Host field.
- API key field.
- Connect button.
- Specific connection errors.

### Frontend Design

This page should look similar to Pair Agent, but visually secondary.

Copy should make clear:

```text
Use this if your Hermes endpoint is already reachable from your phone.
```

It should not be the default onboarding path.

### Data / Behavior

- Calls direct Hermes adapter.
- Probes `/v1/capabilities`.
- Stores API key in Keychain.
- Creates a direct agent record.

### Needs Design/Build

- Better explanation of what "reachable" means.
- Link back to relay pairing.
- Retest/edit mode for settings.
- Keep all errors specific.

## Page: Chat

Route:

```text
/(app)/index
```

File:

```text
src/app/(app)/index.tsx
```

### Purpose

Main product surface.

This is where the user talks to their agent, sees rich output, and handles agent actions.

### Current Structure

- Header.
- Agent status.
- Message list using FlashList.
- User message bubble.
- Agent full-width response layout.
- Composer pinned near keyboard.
- Sidebar for recent chats.
- Markdown reader overlay/surface.
- Approval card component.

### Frontend Design

This page should feel like the cockpit.

Core layout:

```text
[ Header: agent/status/actions ]

Agent output, full width

                         User bubble

[ composer pinned at bottom ]
```

User messages are compact bubbles. Agent messages are not bubbles; they should feel like readable
technical output.

### Data / Behavior

- Uses `useAgents`.
- Gets active agent.
- Uses adapter for direct or relay transport.
- Restores recent session.
- Streams response chunks into the message reducer.
- Persists completed turns.

### Needs Design/Build

- Make relay streaming robust.
- Replace seeded sidebar data.
- Finish session history behavior.
- Add reconnect/disconnected states.
- Add empty chat state that does not feel tutorial-like.
- Wire approve/stop fully to real run capability.
- Make long markdown/code output comfortable to read.

## Page: Cron Drops

Route:

```text
/(app)/cron
```

File:

```text
src/app/(app)/cron.tsx
```

### Purpose

Scheduled job viewer for Hermes-style recurring agent work.

### Current Structure

- Header with summary.
- List of scheduled jobs.
- Job detail view.
- Run trace.
- Pause/resume local interactions.

### Frontend Design

This page should feel operational, not chatty.

It is more like a job monitor:

```text
Cron Drops
3 active schedules - next due soon

[ job row ]
[ job row ]
[ job row ]
```

Detail view should prioritize:

- current state
- next run
- last result
- process trace
- actions

### Data / Behavior

- Loads real jobs through the active agent adapter.
- Direct Hermes uses `/api/jobs`.
- Pause/resume/run-now call Hermes jobs endpoints in direct mode.
- Relay mode currently reports jobs as unavailable until relay job frames are built.

### Needs Design/Build

- Decide if this page ships in MVP.
- If yes for relay-first MVP, add relay/connector job support.
- If no, hide it from production navigation.
- Add proper empty/loading/error states.

## Page: Settings

Route:

```text
/(app)/settings
```

File:

```text
src/app/(app)/settings.tsx
```

### Purpose

Manage account, connection, local data, and support links.

### Current Structure

- Placeholder screen only.

### Frontend Design

Settings should be plain and useful.

Suggested sections:

```text
Account
  Email
  Sign out

Agent
  Active agent
  Transport: relay/direct
  Re-pair / Retest
  Remove agent

Data
  Delete local data

About
  Version
  Privacy
  Support
```

Use rows and sections, not decorative cards.

### Data / Behavior

Should use:

- Supabase auth context.
- AgentProvider.
- Local repository.
- Keychain secret deletion.

### Needs Design/Build

- Full page design.
- Sign out.
- Remove active agent.
- Re-pair flow.
- Direct connection edit/retest.
- Delete local chat data.
- Version/support/privacy links.

## Shared Components

### Chat Components

Files:

```text
src/ui/chat/*
```

Important components:

- `Header`
- `AgentMessage`
- `ApprovalCard`
- `Sidebar`
- `MdReader`
- `CodeBlock`
- `MdFileCard`

Design role:

Make agent output readable and useful. This is one of Summit's most visible advantages over raw
Telegram/Discord bots.

### Cron Components

Files:

```text
src/ui/cron/*
```

Important components:

- `DropCard`
- `CronDetail`
- `ProcessTrace`
- `DropResultCard`
- `StatusDot`

Design role:

Show scheduled work as operational artifacts: status, result, next run, trace.

### Press Animation

File:

```text
src/ui/usePressAnim.ts
```

Design role:

Small tactile feedback for buttons. Keep motion minimal.

## Pages Still Needed

### Pairing Diagnostics

Purpose:

Help debug relay pairing.

Can start as a dev-only page or panel.

Should show:

- Relay URL.
- WebSocket connected/not connected.
- Last relay error.
- Pairing code status.
- Suggested fix.

### Connection Detail

Purpose:

Manage one agent connection.

Should show:

- Agent name.
- Framework.
- Transport.
- Capabilities.
- Last successful connection.
- Re-pair/retest/remove actions.

### Account Settings

Purpose:

Manage Supabase account.

Could be part of Settings first, then split later.

Should include:

- Email/provider.
- Sign out.
- Delete account/support request.

### History

Purpose:

Browse previous agent sessions.

Could live in the chat sidebar first.

Should include:

- Session list.
- Preview.
- Last updated time.
- Delete.

### About / Support

Purpose:

Production support page.

Should include:

- Version/build.
- Support email.
- Privacy policy.
- Terms.
- Website link.

## Frontend Priority Order

1. Pair page error states and diagnostics.
2. Relay chat reliability in Chat.
3. Settings page with sign out, remove agent, re-pair.
4. Replace seeded sidebar/history.
5. Decide whether Cron Drops ships or hides.
6. Polish auth/account pages.
7. Add About/Support.

## The Simple Rule

Every page should answer one of these questions:

```text
Can I connect my agent?
Can I talk to my agent?
Can I understand what my agent is doing?
Can I act when my agent is blocked?
Can I fix or manage my connection?
```

If a page does not help with one of those, it is probably not needed yet.
