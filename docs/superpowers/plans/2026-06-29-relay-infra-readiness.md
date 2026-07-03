# Relay Infrastructure Readiness Plan

Last updated: 2026-06-29

## Goal

Turn the already-provisioned external infrastructure into the minimum production-shaped setup needed
for the Summit relay walking skeleton:

```text
Summit app -> relay.summitapp.dev -> connector on VPS -> localhost:8642 Hermes
```

This plan is not a replacement for `2026-06-29-relay-walking-skeleton.md`. It is the infrastructure
checklist that makes that implementation testable on the real domain/VPS instead of only localhost.

## Current Assumptions

- Cloudflare is set up for the domain/DNS.
- Vercel is set up for the public site/domain.
- An Ubuntu VPS exists.
- Docker is installed on the VPS.
- Cloudflare DNS records are at least partially configured.
- The remaining work is Summit-specific service wiring, not generic server provisioning.

## Target Domain Split

| Host | Owner | Purpose |
|---|---|---|
| `summitapp.dev` | Vercel | Marketing/site root |
| `www.summitapp.dev` | Vercel | Marketing/site alias |
| `relay.summitapp.dev` | Cloudflare Workers or VPS | WebSocket relay traffic |
| `api.summitapp.dev` | Cloudflare Workers or VPS | Pairing/API health endpoints |
| `get.summitapp.dev` | Cloudflare Workers, Vercel, or VPS | Connector installer one-liner |

Do not point the app at the Vercel marketing host for relay traffic. Relay and installer hosts are
product infrastructure, not website pages.

## Phase 1: DNS And Endpoint Inventory

- [ ] Confirm which records exist in Cloudflare for:
  - `summitapp.dev`
  - `www.summitapp.dev`
  - `relay.summitapp.dev`
  - `api.summitapp.dev`
  - `get.summitapp.dev`
- [ ] Decide whether the first relay runs on Cloudflare Workers/Durable Objects or on the VPS in
  Docker.
- [ ] Document the decision in `STACK.md` and keep `docs/CONNECTION.md` consistent.
- [ ] Add a health endpoint for every non-website host:
  - `https://api.summitapp.dev/health`
  - `https://get.summitapp.dev/health` if installer host is not static-only
  - `wss://relay.summitapp.dev` accepts WebSocket upgrade

## Phase 2: Relay Runtime

- [ ] Deploy the relay runtime to the chosen platform.
- [ ] Configure `relay.summitapp.dev` to route to that runtime.
- [ ] Implement minimum relay behavior:
  - connector opens outbound WebSocket
  - relay generates or accepts a 6-digit pairing code
  - app opens WebSocket with the code
  - relay binds app connection to connector connection
  - relay forwards opaque frames both directions
  - relay sends clear errors for missing, expired, or already-used codes
- [ ] Add operational basics:
  - pairing code expiry
  - request/connection rate limits
  - structured logs without message content
  - deploy command documented

## Phase 3: Connector Installer Host

- [ ] Make `https://get.summitapp.dev/connect` return an inspectable install script.
- [ ] The install script must:
  - detect Linux/Ubuntu
  - install or download the connector artifact
  - read Hermes API config from `~/.hermes/.env` when available
  - configure relay URL as `wss://relay.summitapp.dev`
  - install the connector as a background service
  - start the service
  - print the 6-digit pairing code
- [ ] Include a manual fallback path for users who do not want to pipe to shell.
- [ ] Include uninstall instructions.

The connector must daemonize. If it only runs inside the agent's one shell command, the connection
dies when the agent turn ends.

## Phase 4: VPS/Hermes Readiness

- [ ] Confirm Hermes is installed and can run locally on the VPS.
- [ ] Confirm Hermes API server settings:

```text
API_SERVER_ENABLED=true
API_SERVER_KEY=<set>
API_SERVER_HOST=127.0.0.1 or 0.0.0.0
API_SERVER_PORT=8642
```

- [ ] Confirm `curl http://127.0.0.1:8642/v1/capabilities` works on the VPS with the bearer key.
- [ ] Confirm the connector container/binary can reach `http://127.0.0.1:8642`.
- [ ] Confirm the connector can establish outbound WSS to `relay.summitapp.dev`.

Hermes does not need to be exposed publicly for relay mode.

## Phase 5: App Environment

- [ ] Add app env values for the relay skeleton:

```text
EXPO_PUBLIC_RELAY_URL=wss://relay.summitapp.dev
EXPO_PUBLIC_API_URL=https://api.summitapp.dev
EXPO_PUBLIC_CONNECTOR_INSTALL_URL=https://get.summitapp.dev/connect
```

- [ ] Ensure development values still work for local relay testing.
- [ ] Pairing UI should show the installer prompt and a 6-digit code field.
- [ ] Direct host/key mode remains advanced/dev fallback only.

Before changing Expo/React Native code, read the Expo SDK 56 docs required by `AGENTS.md`.

## Phase 6: End-To-End Smoke Test

The infrastructure is ready only when this works:

1. User opens Summit pair screen.
2. User copies the agent-assisted install prompt.
3. User pastes it to the Hermes agent or runs the installer manually on the VPS.
4. Installer starts the connector and prints a 6-digit code.
5. User enters the code in the app.
6. App receives a paired/capabilities response.
7. User sends one chat message.
8. Hermes receives it through the connector.
9. App receives a real streaming reply through the relay.

## Verification Commands

Run from local machine:

```bash
curl -I https://get.summitapp.dev/connect
curl -I https://api.summitapp.dev/health
wscat -c wss://relay.summitapp.dev
```

Run on VPS:

```bash
curl -H "Authorization: Bearer $API_SERVER_KEY" http://127.0.0.1:8642/v1/capabilities
docker ps
docker logs <connector-container>
```

## Done Definition

- DNS resolves for all Summit infrastructure hosts.
- TLS works for HTTPS/WSS hosts.
- Relay accepts app and connector WebSocket connections.
- Installer URL returns a real connector install script.
- Connector runs as a background service on the VPS.
- Connector can reach local Hermes.
- Pairing by 6-digit code works from the app.
- One real Hermes message round-trips through the relay.
