# Technical Reference

Implementation detail for the Agent Messenger mobile app, moved out of `CLAUDE.md` to keep that file
short. This is reference material — see `CLAUDE.md` for the standing working-style rules, and the
"Where product truth lives" table there for which doc is authoritative for what.

## Commands

Standard commands are in `package.json` scripts (`start`, `ios`, `android`, `web`, `lint`, `test`, `test:watch`).
Non-obvious ones:

```bash
npx jest __tests__/smoke.test.ts   # run a single test file
npx jest -t "partial name"         # run tests matching a name
npx tsc --noEmit            # typecheck (strict mode is ON)
```

**The green bar is `npx tsc --noEmit` + `npm test` both passing** — build slices are only considered
complete when typecheck and tests are green (see `.sdd/progress.md`).

**Do not run `npm run reset-project`** — it's a leftover create-expo-app script that moves the app
into `app-example/` and blanks the source. It is not part of this project's workflow.

## Architecture

**What this is:** a React Native (Expo, iOS-first) mobile client for self-hosted AI agents
(Hermes now, OpenClaw later). Users chat with their agent, see its status, and approve/stop blocking
runs from the phone.

Two connection modes are built: relay mode (primary onboarding, via a Go connector sidecar +
Cloudflare Worker relay) and direct mode (advanced fallback, host + API key). The design system is
enforced in code via `src/theme.ts`, not just documented.

## Routing & layout

- `expo-router` with **file-based routing**; entry is `expo-router/entry`. Screens live in
  **`src/app/`** (not root `app/`): `index.tsx` = Connect, `agent.tsx` = chat, `settings.tsx`,
  `_layout.tsx` = the `Stack`.
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- Experiments on: `typedRoutes` and `reactCompiler` (React Compiler — don't hand-add memoization it
  already provides; do follow the rules of hooks strictly).

## Design system is enforced in code, not just documented

- `src/theme.ts` is the **single source of truth** for color, spacing, radius, and type. **Never use
  raw hex or magic numbers in components — import tokens** (`colors`, `space`, `radius`, `typography`,
  `screenPadding`). Note the type-scale export is named **`typography`** (not `type`, which collides
  with the TS keyword).
- `DESIGN_SYSTEM.md` is the spec behind those tokens. The product is **dark-only** (light mode is
  deferred, tokens are semantic so it's a later swap), system font everywhere, **one** restrained
  accent (`#5B9DFF`) used sparingly; the primary button is a light `ink` fill, not the accent.
  Whitespace over borders/boxes. Message layout is **hybrid**: user = right-aligned bubble on
  `surface`; agent = full-width, no bubble. Long lists use `@shopify/flash-list`.

## Hermes integration

See `FRAMEWORKS.md` before writing any integration code.

- OpenAI-compatible API on port `8642`. Auth: `Authorization: Bearer <key>`.
- Connect probes `GET /v1/capabilities`. Chat is `POST /v1/chat/completions` with SSE streaming
  (`react-native-sse`), carrying `X-Hermes-Session-Id` + `X-Hermes-Session-Key` for continuity.
  Approve/stop use the Runs API (`/v1/runs/{id}/approval`, `/stop`); gate the approve UI on the
  `run_approval` flag from `/v1/capabilities` at runtime.
- **Hard Hermes constraints — don't design around them:** one server = one agent (no multi-agent
  endpoint); **no file upload** (inline images only); the `model` field is cosmetic; the server is
  **inbound-only** and can't dial out.
- Credentials are stored on-device only via `expo-secure-store` (iOS Keychain). Nothing leaves the
  phone except calls to the user's own server.

## Multi-agent: two-track architecture (built)

Per `docs/superpowers/plans/2026-07-03-multi-agent-product-direction.md`:
- **Tier 1 (native ceiling):** Hermes (live), OpenClaw (stub). **Tier 2 (generic floor):** any
  OpenAI-compatible server (Ollama, LM Studio, llama.cpp, …) via `src/agents/adapters/openai.ts` —
  probe `GET /v1/models`, chat SSE `/v1/chat/completions`. The connect flow **detects** the
  framework (Hermes probe → generic fallback in `src/agents/connect.ts`); the user never picks one.
- **Capability-driven UI:** features surface from `agent.capabilities` (fall back to
  `defaultCapabilitiesFor()` in `src/agents/frameworks.ts`). `hasJobs` gates the sidebar Cron item;
  generic agents get the clean messaging floor with no dead chrome.
- The connector announces `AGENT_FRAMEWORK` (default `hermes`) in its hello frame; the pair screen
  stores it. Tester loops (mock agent, all channels): `docs/TESTING.md`, `scripts/mock-agent.mjs`.
- **Push notifications (relay mode only):** the relay DO stores the device's Expo push token
  (`register_push` frame, sent at pair + every adapter reconnect) and POSTs to the Expo Push API
  when a turn finishes or a `notify` frame arrives while no app socket is attached. Auto-pushes are
  **content-free** (transcript never transits push servers); agent-chosen nudges come from the
  connector's loopback endpoint `POST localhost:8643/notify {title, body}` (`NOTIFY_PORT` env).
  App side: `src/notifications/push.ts` (expo-notifications is dynamically imported; everything
  degrades to null off-device). Adding the native module means the dev client needs a rebuild.

## Connection modes — both are now built

- **Slice 1 — direct mode.** `src/app/(app)/connect.tsx`: host + API key, auto-detects Hermes vs
  generic OpenAI-compatible. Works only where the host is reachable (LAN / Tailscale / tunnel).
  (`ONBOARDING.md`)
- **Slice 3a/3b/3c — relay mode** (fully deployed). `src/app/(app)/pair.tsx` is the **primary
  onboarding** path — a 3-step screen: copyable agent prompt → copyable curl command → pairing-code
  entry. A Go **connector sidecar** (`/connector/`) runs next to Hermes and dials outbound to a
  Cloudflare Worker relay (`/relay/`). Shared frame types in `/protocol/`. Key details:
  - **Relay live** at `wss://relay.summitapp.dev` (Cloudflare Worker + Durable Object).
  - **Install script live** at `https://get.summitapp.dev/connect` — served by the same relay Worker
    (`relay/src/install-script.ts`). `curl -fsSL https://get.summitapp.dev/connect | sh` detects
    arch, reads Hermes API key from `~/.hermes/.env`, daemonizes via systemd or nohup, prints code.
  - **Connector binaries** on GitHub Releases (`connector-latest` tag) for linux/darwin amd64+arm64,
    built by `.github/workflows/release-connector.yml` on every push.
  - **CI deploy** via `.github/workflows/deploy-relay.yml` — runs `wrangler deploy` on push.
  - **Cloudflare gotchas:** free plan requires `new_sqlite_classes` (not `new_classes`) in
    `relay/wrangler.toml`; wrangler@4 required (v3 doesn't support it); custom domains must be
    attached manually in the dashboard (API token from "Edit Cloudflare Workers" template lacks DNS
    permissions). `RELAY_WS_URL` in `src/config.ts` is `ws://localhost:8787` dev / `wss://relay.summitapp.dev` prod.

The no-agent guard in `src/app/(app)/_layout.tsx` redirects to `/pair` (relay-first). The connect
screen is the "advanced" escape hatch, linked from the pair screen.
