# Summit for OpenClaw

Native OpenClaw channel plugin for [Summit](https://summitapp.dev) — talk to your
OpenClaw agent from the Summit mobile app.

```bash
openclaw plugins install clawhub:SummitAI-app/summit-openclaw
# restart the gateway, then read the pairing code out of its logs
```

Enter the code in the Summit app and you're paired.

## Why a plugin

Summit already talks to OpenClaw through a Go connector, and it will keep doing
so — a user who never installs this plugin loses nothing. The connector dials
the Gateway's operator WebSocket from *outside* OpenClaw and re-implements the
handshake. This plugin runs *inside* the Gateway process, so it hands messages
straight to the same inbound pipeline Telegram and Discord use. That is what
unlocks the things the connector structurally cannot reach: native approval
cards, real per-tool activity instead of a spinner, and event-driven cron
delivery.

Paired hosts report `via: "plugin"`, which is how the app tells a native install
apart from the compatibility connector.

## What works today (Phase 1)

- Outbound `wss://` to Summit's relay — no inbound port, no token pasted into
  the phone, the secret never leaves the host
- Pairing code issue, display, rotation on expiry, and channel reclaim across
  restarts
- Chat round-trip: app message → OpenClaw agent turn → streamed reply
- Durable reply outbox, so a turn that finished while the phone was off is
  still delivered on reconnect
- Agent-initiated messages to a Summit conversation via OpenClaw's shared
  `message` tool

Not yet: native approvals, structured tool activity, cron push, sessions. Those
are Phases 2–5 in
`docs/superpowers/plans/2026-08-04-openclaw-native-plugin-plan.md`.

## Configuration

Everything has a working default; an install needs no config at all.

```json5
{
  channels: {
    summit: {
      enabled: true,                     // installing the plugin is the opt-in
      relayUrl: "wss://relay.summitapp.dev",
      agentName: "OpenClaw",             // shown in the app once paired
      stateDir: "…",                     // pairing identity + reply outbox
    },
  },
}
```

## Security model

The pairing code is a short-lived, single-use transfer mechanism for a durable
session token — never a long-lived credential. Only a device holding that token
can get a frame forwarded to this plugin, which is why the channel carries no
allowlist of its own: the relay is the authorization boundary, one layer below.
Pairing identity and settled replies are written owner-only and stay on your
host; the relay never stores transcript content.

## Development

```bash
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # esbuild -> dist/
```

The wire contract lives in the Summit app repo at `protocol/protocol.ts` and is
inlined at build time, so there is exactly one definition of it and no copy to
drift.
