# Summit for Hermes 0.1.0 — DRAFT release notes (not published)

> Status: staged as a draft GitHub Release at
> https://github.com/SummitAI-app/Summit-Hermes/releases/tag/untagged-0ab69862500913c4fe15
> (no tag cut, no watchers notified). Publishing is on hold — revisit before pushing live.
> When published, also update `CHANGELOG.md` in Summit-Hermes from
> `## 0.1.0 - Unreleased` to `## 0.1.0 - <publish date>` in the same push.

First alpha release of the native Hermes platform plugin.

A self-hosted Hermes agent can now be reached from the Summit mobile app over an
authenticated outbound WebSocket. No inbound port is opened, and the Hermes API key
never leaves the host. Text chat works end to end: native Hermes sessions, streamed
drafts, live activity while a turn runs, reconnect, and replies that survive the phone
being locked, offline, or closed.

### Added

- Native Hermes platform registration and pairing through a six-digit, short-lived
  code. The durable connector credential is written only to the Hermes host at `0600`.
- Native session routing with draft streaming when Hermes gateway streaming is enabled.
- Durable, acknowledged offline reply outbox — completed replies are committed locally
  before the terminal frame is sent, then downloaded and acknowledged after reconnect.
- Live tool activity labels ("Searching the web…", "Running a command…") while a turn
  is running, without exposing tool names, arguments, or previews.
- Cron job controls: list, inspect, run, pause, and resume existing Hermes jobs through
  a fixed local-only endpoint allowlist. Job creation and deletion are not exposed.
- Standalone cron delivery, so scheduled jobs running outside the gateway process can
  deliver results into Summit's durable outbox.
- Native `/model` picker surfaced through Hermes' own `send_model_picker` hook and
  advertised as the `model_picker` capability. The plugin transports Hermes' payload
  and returns the choice; it never enumerates models or sees a provider key.

### Fixed

- Plugin loading and relay keepalive/disconnect diagnostics on early Hermes hosts.
- Event delivery compatibility with Hermes 0.16.

### Known limits

- This is an alpha. Rich attachments and native approval cards are not in this release.
- Streaming requires `gateway.streaming.enabled: true` on the Hermes host. Without it
  the plugin still works, but replies arrive only when complete.
- Cron controls require Hermes' API server to be configured with its normal
  `API_SERVER_KEY`. They are off unless you enable it.
- Plain `ws://` relay endpoints are rejected outside loopback development hosts, and
  credentials embedded in a relay URL are rejected.

### Install

```bash
hermes plugins install SummitAI-app/Summit-Hermes
hermes gateway restart
```

Hermes prints a six-digit pairing code. In Summit, choose **Add agent → Hermes plugin**
and enter it. Treat the code like a password while it is active.

See [Architecture](docs/ARCHITECTURE.md) and [Threat model](docs/THREAT_MODEL.md) for
the full trust boundaries.
