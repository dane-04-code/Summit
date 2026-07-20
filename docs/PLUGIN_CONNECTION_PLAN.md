# Summit Native Plugin Build Programme

_Status: architecture approved for implementation planning. Hermes is first; OpenClaw follows.
Last verified against upstream source: 2026-07-19._

## The decision in plain English

Summit should offer a native plugin for Hermes and a native plugin for OpenClaw. The plugin becomes
the recommended agent-side connection, but it remains optional. It replaces the separate Go
connector for supported harness versions; it does **not** replace Summit's hosted relay.

```text
Recommended

Summit app  <── WSS ──>  Summit relay  <── WSS ──>  Summit plugin  <── native API ──>  Agent
   iPhone                 Cloudflare                    user host                   Hermes/OpenClaw

Compatibility fallback

Summit app  <── WSS ──>  Summit relay  <── WSS ──>  Go connector  <── HTTP/WS ──>  Agent
```

This is the same durable shape used by Telegram, Discord, and Slack bots: the agent-side process
and server remain online; the phone is only a client. Closing or locking the app does not stop the
agent's turn.

## What lives where

| Part | Where it runs | What it owns | What it must not own |
|---|---|---|---|
| Summit iOS app | User's phone | Local agent/session metadata, structured chat, device token | Hermes/OpenClaw server credentials |
| Summit relay | Cloudflare Worker + Durable Object | Pairing, authenticated routing, connected-device push trigger | Transcripts at rest, agent execution |
| Hermes plugin | Inside Hermes gateway | Native channel, relay socket, pairing identity, output/replay | LLM/provider logic, billing |
| OpenClaw plugin | Inside OpenClaw Gateway | Native channel, relay socket, pairing identity, receipts/replay | LLM/provider logic, billing |
| Go connector | Separate service on user host | Legacy/generic bridge | Default install once plugins are proven |

The account remains above pairing for billing and recovery. Pairing still mints a distinct
per-device token. The agent's own API key or Gateway token never needs to reach the phone or relay.

## Repository and hosting decision

Use a **company-owned GitHub organisation** and two public repositories:

```text
github.com/SummitAI-app/Summit-Hermes
github.com/SummitAI-app/summit-openclaw
```

Two repositories are cleaner than one monorepo because the native package roots, languages,
installers, compatibility ranges, tests, and release cadence are different. The repositories
should share protocol fixtures by copying a versioned release artifact from this Summit repository,
not by importing runtime code from each other.

GitHub is the best source-of-truth host because both communities already use Git-based plugin
installation, public code improves trust, tagged releases make audits reproducible, and GitHub
Actions can test against pinned harness versions. Create them under the company organisation—not a
founder's personal account—so ownership, signing keys, release access, and continuity survive team
changes.

### Distribution by harness

| Stage | Hermes | OpenClaw |
|---|---|---|
| Local development | Local plugin directory/link | `openclaw plugins install --link ./` |
| Private beta | Pinned Git tag/commit from GitHub | Pinned `git:github.com/...@<tag>` install |
| Stable | GitHub tag via `hermes plugins install SummitAI-app/Summit-Hermes --enable`; consider a pip entry point later | Publish to ClawHub for native discovery and npm for deterministic package/version workflows |
| Release proof | Clean Hermes install, enable, restart, status check | `npm pack`, managed `npm-pack:` install, runtime inspect, then ClawHub install proof |

Hermes explicitly recommends standalone repositories for third-party product integrations and
supports Git installs. OpenClaw describes ClawHub as the primary public discovery surface while
also supporting npm and Git. Source remains GitHub in both cases.

Do not auto-update from `main`. Publish signed/tagged releases, changelogs, checksums where
applicable, and compatibility notes. MIT is the selected code licence for the plugins. Do not copy
the main app's stale Expo licence.

## The shared Summit contract

Both plugins speak one versioned protocol so the app and relay do not grow framework-specific
transport branches. Framework differences are translated at the plugin boundary.

### Protocol v2 work required before plugin beta

The current protocol already has pairing, chat chunks, settled reply replay, push nudges, API proxy,
and approvals. Add these fields/events without breaking the Go connector's v1 path:

- `protocolVersion`, `pluginVersion`, `frameworkVersion`, and negotiated `capabilities` in `hello`.
- A structured `event` envelope with stable `eventId`, `reqId`, `sessionId`, `sequence`, `kind`,
  `payload`, and timestamp.
- Output kinds for `text_delta`, `text_final`, `tool_started`, `tool_progress`, `tool_finished`,
  `status`, `approval_requested`, `approval_resolved`, `error`, and `turn_finished`.
- Idempotent input identifiers so a reconnect cannot start the same user turn twice.
- Explicit maximum frame size, unsupported-capability response, and protocol-upgrade error.

The relay treats event payloads as opaque bytes/JSON and only routes them. The app's framework
adapter turns these events into the shared structured message model in `src/ui/chat/types.ts`.

### One complete turn

```text
1. App persists the user's message locally.
2. App sends chat(reqId, sessionId, idempotencyKey) to the relay.
3. Relay forwards it to the paired plugin.
4. Plugin durably admits the input, then hands it to the native harness channel.
5. Harness owns the agent turn even if the phone disconnects.
6. Plugin emits structured progress and text events when the phone is present.
7. Plugin stores the settled result in its bounded local outbox before declaring completion.
8. Relay triggers content-free push if the app is absent.
9. App reconnects, requests sync, persists each reply in SQLite, then acknowledges its event ID.
10. Plugin deletes acknowledged outbox rows. Replays are idempotent, so the reply appears once.
```

### Security upgrade path

TLS-to-relay is acceptable for the first closed beta, provided the relay stores no transcript and
logs no content. Before a broad trust claim, add end-to-end encryption between app and plugin:

1. Pairing exchanges device/plugin public keys through the relay.
2. App and plugin derive a per-pairing session key.
3. Content-bearing frames are encrypted and authenticated before reaching the relay.
4. The relay sees routing metadata and ciphertext only.
5. Push remains content-free.

Design protocol v2 so encrypted payloads can be introduced without changing frame routing.

## Build order

### 0. Shared contract foundation

- Freeze v2 event names, limits, retry rules, and capability negotiation.
- Produce JSON fixtures for pair, resume, chat, stream, approval, disconnect, sync, and ack.
- Make app, relay, and Go connector pass the same compatibility fixtures.
- Add an encrypted-payload placeholder to avoid a later routing redesign.

### 1. Hermes proof and beta

- Prove native text draft streaming, tool progress, approval presentation, stop, cron delivery, and
  gateway restart behaviour with a minimal local platform plugin.
- Build pairing, relay transport, durable outbox, and structured output.
- Release a pinned GitHub beta and test on clean Linux/macOS Hermes hosts plus a real iPhone.
- Keep the Go connector visible as the fallback.

The full implementation map is in [HERMES_PLUGIN_BUILD_PLAN.md](./HERMES_PLUGIN_BUILD_PLAN.md).

### 2. OpenClaw proof and beta

- Pin one OpenClaw plugin API line and prove channel ingress, live output, delivery receipts,
  persistent dedupe, approvals, and account/session routing.
- Build the native TypeScript package and publish a Git beta.
- After managed-package and live-host proof, publish to npm and ClawHub.

The full implementation map is in
[OPENCLAW_PLUGIN_BUILD_PLAN.md](./OPENCLAW_PLUGIN_BUILD_PLAN.md).

### 3. Default-path cutover

- Compare install completion, reconnect rate, duplicate/lost reply rate, and support volume against
  the Go connector.
- There are no existing users or pairings to migrate. Do not build credential-import machinery for
  a migration that does not exist.
- Make the native plugin the onboarding headline after it reaches parity in those measures.
- Freeze the connector as an internal comparison tool and optional fallback for old harness
  versions or generic OpenAI-compatible servers; archive it later if usage never justifies it.

## Shared release gates

A plugin is not stable until all of these are true:

- Install, configure, pair, update, roll back, disable, and uninstall are documented and tested.
- Locking the phone, killing the app, changing networks, and restarting the agent host lose no
  settled reply and create no duplicate reply.
- A plugin upgrade never silently breaks an existing pairing.
- The relay stores no transcript; push contains no transcript; plugin logs redact tokens/content.
- Protocol compatibility tests cover the app, relay, connector, and both plugins.
- The advertised streaming, approval, stop, and media capabilities are backed by live tests.
- A dependency/security review and reproducible package inspection pass before every stable tag.

## What we are deliberately not building in these plugins

- No model/provider routing, agent tools, shell execution, or billing.
- No cloud transcript database.
- No second relay protocol per framework.
- No hidden auto-install or auto-update mechanism.
- No attempt to make Hermes support file upload when it does not.
- No removal of direct mode or the Go connector until real usage justifies it.

## Verified upstream sources

Research was checked on 2026-07-19 against Hermes commit
[`36f2a96`](https://github.com/NousResearch/hermes-agent/commit/36f2a966c7f9f69987494b867c3dcf96b69a5766)
and OpenClaw commit
[`6c9b31e`](https://github.com/openclaw/openclaw/commit/6c9b31e4d5604a82f2d9cfba64bb8a7cbb0e2de8).

- [Hermes: adding platform adapters](https://hermes-agent.nousresearch.com/docs/developer-guide/adding-platform-adapters)
- [Hermes: plugin system and Git installation](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins)
- [Hermes: event hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)
- [OpenClaw: building plugins](https://docs.openclaw.ai/plugins/building-plugins)
- [OpenClaw: channel plugins](https://docs.openclaw.ai/plugins/sdk-channel-plugins)
- [OpenClaw: plugin installation](https://docs.openclaw.ai/tools/plugin)
