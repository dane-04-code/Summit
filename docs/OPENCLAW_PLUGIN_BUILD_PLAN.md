# Summit for OpenClaw — Complete Build Plan

_Status: second native plugin target, built after the Hermes plugin establishes Summit protocol
v2. This describes the planned standalone repository `SummitAI-app/summit-openclaw`; it does not
create or publish that repository._

## 1. What the OpenClaw plugin is

The Summit OpenClaw plugin is a native **messaging channel plugin**. To OpenClaw, Summit behaves
like Discord, Slack, or Telegram. To the Summit app, it behaves like a durable connection to one
routed OpenClaw agent.

```text
Summit app
    │ chat / controls / sync
    ▼
Cloudflare relay (route only)
    │ persistent outbound WSS
    ▼
Summit channel plugin (inside OpenClaw Gateway)
    │ channel ingress / message adapter / receipts
    ▼
OpenClaw Gateway → session routing → selected agent → tools/model
```

The plugin does not connect back into OpenClaw over its external WebSocket API. It runs in-process
and uses the supported plugin SDK. This removes a duplicated control-plane connection and gives
Summit native message lifecycle, durability, routing, and delivery semantics.

## 2. Why this is the correct OpenClaw extension point

OpenClaw's official external messaging surface is a channel plugin created with
`defineChannelPluginEntry`. Core owns the shared message tool, prompt wiring, outer session-key
shape, and generic dispatch. The channel plugin owns configuration, security, transport pairing,
conversation identity, inbound admission, outbound delivery, and receipts.

That ownership matches Summit directly:

| Summit need | OpenClaw seam |
|---|---|
| Register a native channel | `defineChannelPluginEntry` + `api.registerChannel` |
| Lightweight disabled/setup load | `setup-entry.ts` + `defineSetupPluginEntry` |
| Admit phone messages durably | Channel ingress lifecycle / `createChannelIngressMonitor` |
| Route to an agent/session | Channel account configuration and conversation grammar |
| Send settled replies | Channel message adapter returning `MessageReceipt` |
| Stream rich live output | Declared `message.live.capabilities` and finalizer contract |
| Prevent replay | Durable ingress tombstones and persistent dedupe where identities differ |
| Run continuously | Plugin service inside the long-lived OpenClaw Gateway |
| Approvals and stop | Native Gateway/plugin surfaces after the O0 proof spike |

Do not build a general agent tool that manually calls Summit. A tool runs only when the model
chooses it and cannot serve as a reliable always-on channel.

## 3. Source hosting and distribution

### Repository

Create a public company-owned repository:

```text
github.com/SummitAI-app/summit-openclaw
```

Use protected `main`, required CI, signed release tags, CODEOWNERS, two maintainers minimum,
dependency update automation, `SECURITY.md`, a release checklist, and an MIT licence.

### Package identity

Recommended names:

```text
Repository:       SummitAI-app/summit-openclaw
npm package:      @summitapp/openclaw-summit
OpenClaw plugin:  summit
Channel id:       summit
ClawHub package:  @summitapp/openclaw-summit (subject to registry availability)
```

Reserve names before documenting them as final. Never publish the package from a personal npm or
ClawHub owner when a company organisation can own it.

### Distribution ladder

1. Local development: `openclaw plugins install --link ./summit-openclaw`.
2. Closed beta: pinned Git tag with
   `openclaw plugins install git:github.com/SummitAI-app/summit-openclaw@v0.x.y --force` after source
   review. Arbitrary Git is intentionally treated as untrusted by OpenClaw.
3. Package proof: build JavaScript, run `npm pack`, install with OpenClaw's managed `npm-pack:`
   path, and inspect the live runtime.
4. Stable: publish the same signed/tagged source to npm and ClawHub. ClawHub is the primary native
   discovery route; npm supplies normal registry versioning and dist-tags.

Every release pins compatible `pluginApi` and minimum Gateway versions. Never track OpenClaw
`latest` implicitly and never auto-execute code from `main`.

## 4. Planned repository structure

```text
summit-openclaw/
  README.md                         install, pair, update, remove, troubleshoot
  LICENSE
  SECURITY.md
  CHANGELOG.md
  package.json                      package, ESM, built entry points, compat ranges
  openclaw.plugin.json              channel ownership and cold config schemas
  tsconfig.json
  index.ts                          defineChannelPluginEntry
  setup-entry.ts                    defineSetupPluginEntry; no sockets/heavy imports
  src/
    channel.ts                      channel definition and account inspection
    config.ts                       typed plugin/channel config resolution
    service.ts                      runtime start/stop and relay client ownership
    relay-client.ts                 WSS state machine, heartbeat, reconnect
    protocol.ts                     Summit protocol v2 encode/decode
    pairing.ts                      connector identity and six-digit pairing state
    ingress.ts                      durable admission and OpenClaw dispatch
    conversation.ts                 Summit session ↔ OpenClaw conversation grammar
    outbound.ts                     message adapter, live updates, finalization
    receipts.ts                     Summit event IDs ↔ MessageReceipt mapping
    outbox.ts                       settled results awaiting app acknowledgement
    approvals.ts                    approval/stop bridge after O0 proof
    capabilities.ts                 honest negotiated capability snapshot
    storage.ts                      plugin state stores and migrations
    redaction.ts                    content/token-safe diagnostics
    diagnostics.ts                  health/compatibility support output
    types.ts
    *.test.ts
  test/
    fixtures/                       shared Summit protocol vectors
    contract/                       OpenClaw message/live/receipt proofs
    integration/
  scripts/
    smoke-install.mjs
  .github/workflows/
    ci.yml
    release.yml
```

Published package entry points must reference built JavaScript under `dist/`; TypeScript source
entry points are only for a source checkout. Runtime imports belong in `dependencies` or
`optionalDependencies`, not only `devDependencies`.

## 5. Manifest and compatibility shape

The exact version range is selected during O0 and must not be guessed in the published package.
The planned metadata shape is:

```json
{
  "name": "@summitapp/openclaw-summit",
  "version": "0.1.0",
  "type": "module",
  "peerDependencies": {
    "openclaw": "<tested range>"
  },
  "openclaw": {
    "extensions": ["./dist/index.js"],
    "setupEntry": "./dist/setup-entry.js",
    "channel": {
      "id": "summit",
      "label": "Summit",
      "blurb": "Connect your OpenClaw agent to the Summit mobile app."
    },
    "compat": {
      "pluginApi": "<tested range>",
      "minGatewayVersion": "<tested minimum>"
    }
  }
}
```

`openclaw.plugin.json` declares `channels: ["summit"]`, cold-path channel configuration schemas,
sensitive UI hints, and intentional startup activation. It must not claim tools, privileged
middleware, or trusted policies the plugin does not register.

`setup-entry.ts` stays import-light. It registers only setup/configuration surfaces when Summit is
disabled or unconfigured. WSS clients, durable workers, and runtime services load only in full
registration mode.

## 6. Configuration and identity

### Initial channel configuration

| Setting | Required | Default | Meaning |
|---|---:|---|---|
| Relay URL | No | `wss://relay.summitapp.dev` | Custom/self-hosted relay supported |
| Agent ID | No | `main` | OpenClaw agent this Summit pairing targets |
| Account ID | No | `default` | Plugin runtime/account scope |
| Notification mode | No | inherited from app pairing | All, attention, or off |
| Log level | No | `info` | Content/token redaction always active |

There is no OpenClaw Gateway token in the plugin configuration. The plugin already runs inside the
Gateway. Its Summit connector credential is created at pairing and stored in the plugin-owned state
directory with owner-only permissions.

### One pairing, one Summit Agent

OpenClaw is multi-agent, but Summit's on-device model correctly represents one configured agent per
pairing. For the first release:

- A Summit channel account targets one configured OpenClaw `agentId`, defaulting to `main`.
- The plugin announces that routed agent's ID/name/capabilities during pairing.
- Every Summit session under that pairing routes to that agent with a stable conversation key.
- Pairing multiple OpenClaw agents from one Gateway is a follow-on implemented as multiple plugin
  accounts/pairings—not a hidden agent switch inside an existing chat.

This avoids mixing histories, approvals, permissions, and billing identity between OpenClaw agents.

## 7. Local persistence

Use OpenClaw's plugin state stores and durable ingress helpers where their contracts fit. Do not
create parallel persistence just because the Go connector used a JSON file.

```text
connector identity/token       durable and secret
pairing/account metadata       durable and non-secret except connector token
durable ingress rows           accepted phone events awaiting dispatch adoption
completion tombstones          replay protection for the documented retention window
settled reply outbox           at most 100 replies awaiting phone acknowledgement
receipt/finalizer state        pending live previews and terminal delivery identity
schema/plugin versions         migration and diagnostics
```

OpenClaw's ingress completion tombstone is sufficient when its event ID is the same stable Summit
input ID and retention covers the replay window. Add `persistent-dedupe` only when a logical
message identity differs or needs longer retention. Redundant dedupe stores create subtle expiry
and duplicate-execution bugs.

The ingress contract is at-least-once around side effects. Use OpenClaw's effect-once helper for
non-idempotent plugin effects such as credential/config changes; normal agent dispatch is protected
by Summit input idempotency and durable adoption state.

## 8. Runtime state machine

```text
DISABLED / UNCONFIGURED
        │ setup + enable + Gateway full registration
        ▼
STARTING ── incompatible manifest/API ──> FATAL_DIAGNOSTIC
        │
        ▼
CONNECTING ── transient failure ──> BACKOFF ── jittered timer ──> CONNECTING
        │ WSS established
        ▼
UNPAIRED ── hello ──> CODE_AVAILABLE ── app pair ──> PAIRED
                                                    │ network loss
                                                    ▼
                                               RECONNECTING
                                                    │ credential resume
                                                    ▼
                                                  PAIRED
```

OpenClaw registration modes matter: discovery, setup-only, tool-discovery, and CLI metadata loads
must not open relay sockets or start background workers. Only full runtime registration owns the
long-lived relay service.

## 9. Detailed flows

### A. Install, configure, and pair

1. User installs a pinned package and explicitly enables/allows the `summit` plugin.
2. OpenClaw validates the manifest, compatibility range, plugin policy, and cold channel schema.
3. Setup selects an `agentId` (default `main`) and relay URL.
4. Gateway restarts/reloads and full registration starts the Summit channel service.
5. Plugin opens outbound WSS and sends protocol/plugin/OpenClaw/agent capability metadata.
6. Relay returns a single-use six-digit code and durable connector credential.
7. User enters the code in Summit; relay issues the phone's device token.
8. Plugin retains pairing across Gateway and host restarts.

Acceptance: `openclaw plugins inspect summit --runtime --json` proves the channel/service is live,
and no Gateway token or host URL is copied into the phone.

### B. Phone message into OpenClaw

1. Plugin receives `chat` with stable `inputId`, `reqId`, Summit `sessionId`, and supported content.
2. The transport receive chokepoint appends the raw envelope to durable ingress before admission is
   acknowledged.
3. One serialized lane per Summit conversation preserves order.
4. `conversation.ts` maps the Summit session to the configured OpenClaw agent/account and stable
   channel conversation ID.
5. The channel ingress lifecycle performs native sender/security projection, records the inbound
   message, and dispatches it through OpenClaw core.
6. Dispatch adoption tombstones the ingress row. A repeated input ID is rejected/reconciled rather
   than starting another agent turn.

Summit pairing authentication is the transport identity. Do not expose an open DM policy or accept
unpaired relay traffic. OpenClaw's normal channel security expectations still apply; the plugin
must make its single-user/private nature explicit.

### C. OpenClaw output to Summit

1. The message adapter receives outbound text/media/live operations from core.
2. `outbound.ts` translates supported native output into ordered Summit protocol events.
3. Live preview updates share one stable message/event identity.
4. The adapter returns a real `MessageReceipt` derived from the Summit relay event ID.
5. Finalization edits/completes the preview or falls back to a normal final message according to
   the declared contract.
6. The settled structured result enters the local outbox before terminal success is exposed.

Declare only capabilities we prove with the official contract helpers:

| OpenClaw live capability | Summit meaning | Initial target |
|---|---|---|
| `draftPreview` | One growing assistant response | Yes |
| `previewFinalization` | Draft becomes canonical final response | Yes |
| `progressUpdates` | Tool/status blocks update without transcript spam | Proof in O0 |
| `nativeStreaming` | Ordered live content through channel transport | Yes if contract proves it |
| `quietFinalization` | Finish without duplicate visible message | Yes if proven |
| `finalEdit` | Final content can replace preview | Yes |
| `normalFallback` | Safe final send when edit/finalize fails | Yes |
| `retainOnAmbiguousFailure` | Avoid deleting possibly delivered content | Yes |

Capability drift between declaration and behaviour is a release-blocking test failure.

### D. Phone closed, killed, or offline

1. OpenClaw Gateway and the plugin remain active on the user's host.
2. Accepted work continues after the mobile WebSocket disappears.
3. Live previews do not need durable token-by-token storage.
4. Final reply is committed to the bounded local outbox.
5. Relay receives a content-free push instruction.
6. On reconnect, the app requests sync, persists by stable event ID, then acknowledges.
7. Plugin deletes acknowledged outbox entries. Reconnect/replay yields exactly one app message.

This works only while OpenClaw Gateway is running. Installation diagnostics must check that the
Gateway is managed as a restartable service; an in-process plugin cannot survive its host process.

### E. Approvals and stop

OpenClaw execution approvals live in its WebSocket-first Gateway control plane. The current Go
connector proves they can be observed and resolved externally, but that does not prove a channel
plugin has the same supported in-process seam.

O0 must establish:

- Which public plugin event/hook/RPC surface exposes an approval request to the owning Summit
  conversation.
- How the plugin resolves allow-once/deny without bypassing OpenClaw policy.
- How approval IDs map safely to agent/account/session and expire.
- Which native API stops or steers an active run for the routed session.

After proof, translate approval requests into structured `approval_requested` events and app
responses into the native resolver. If the public SDK lacks a safe resolver, ship chat without
advertising structured approval and retain the Go connector path for that capability while an
upstream issue/extension is pursued. Never call private internal modules in a stable release.

### F. Proactive messages

Heartbeats, scheduled work, and agent-initiated sends use the same channel message adapter. The
configured Summit account/session provides the delivery target. Proactive output receives a
plugin-generated request ID, enters the settled outbox, and triggers privacy-safe push when the app
is away.

### G. Media

OpenClaw supports richer media than Hermes, but cross-framework Summit v1 does not promise general
file upload. Start with text and supported inline images behind negotiated capabilities. Add image/
PDF upload only after the app protocol, storage, size limits, sandbox path policy, and Hermes
product asymmetry are deliberately designed. Do not let OpenClaw's capability silently expand the
v1 promise.

### H. Reload, update, and rollback

1. Channel stop settles accepted transport admissions, then disposes and awaits its ingress drain.
2. Relay socket closes cleanly while pairing identity/outbox remain durable.
3. Fresh runtime reopens the same account-keyed queue; its normal initial drain recovers pending
   work. Do not add a second reload-specific replay mechanism.
4. Schema migrations are transactional and backward-readable for at least one stable release.
5. Update/rollback retains pairing. Plugin code updates may restart Gateway but must not duplicate
   adopted work.

## 10. Session and output mapping

### Session identity

```text
Summit agent row     → one plugin pairing/account + one OpenClaw agentId
Summit session ID    → one stable OpenClaw channel conversation
Summit request ID    → one agent turn/idempotency identity
Summit event ID      → one outbound receipt/settled replay identity
```

Never route based only on a display name. Persist stable OpenClaw agent/account IDs and include
them in approval and output correlation.

### Output events

| Native observation | Summit event | App presentation |
|---|---|---|
| typing/run begins | `status(running)` | Header/activity state |
| live preview/delta | `text_delta` or `text_preview` | One growing response |
| tool begins | `tool_started` | Collapsed tool block |
| progress update | `tool_progress` | Updated block, no transcript spam |
| tool ends | `tool_finished` | Success/error and safe result summary |
| final message/receipt | `text_final` | Settled markdown/code/table blocks |
| Gateway approval | `approval_requested` | Action Request card when proven |
| final outbox commit | `turn_finished` | Persisted completed turn |
| runtime/transport failure | `error` | Recoverable or fatal error state |

## 11. Milestones and acceptance criteria

### O0 — SDK and control proof spike (3–5 engineering days)

- Minimal external channel installs through local link and managed packed-package paths.
- One phone-style ingress message reaches configured agent `main` with stable session routing.
- One live preview finalizes with a valid receipt and no duplicate final message.
- Prove tool progress, approval resolution, stop/steer, proactive send, and Gateway restart seams.
- Select and record the minimum supported `pluginApi` and Gateway range.

### O1 — Channel, relay, and pairing skeleton (4–6 days)

- Manifest/setup/full registration split, typed config, service lifecycle.
- WSS pairing/resume, capabilities, basic text ingress/outbound.
- Shared Summit protocol v2 fixtures pass.

### O2 — Durable ingress and background completion (5–7 days)

- Durable admission, serialized conversation lanes, completion tombstones.
- Settled outbox, sync/ack, restart recovery, duplicate suppression.
- App-killed and Gateway-restart scenarios produce exactly one settled reply.

### O3 — Native output and controls (5–8 days)

- Contract-proven live preview, finalization, receipts, status, and structured progress.
- Approval and stop at the capability level actually proven in O0.
- Proactive output and privacy-safe push.

### O4 — Security, packages, and public beta (5–8 days)

- Limits, redaction, config permissions, dependency/install-policy review.
- `npm pack` and managed `npm-pack:` proof, Git beta, then npm/ClawHub release candidate.
- Compatibility matrix and clean-host/device beta evidence.

Expected build: roughly **4–6 focused engineering weeks** after the shared protocol and Hermes
implementation exist. Reusing the protocol and app work saves time; OpenClaw's SDK compatibility,
durability proofs, and approval uncertainty add it back.

## 12. Test matrix

| Layer | Required proof |
|---|---|
| Unit | Config, state machine, frame validation, redaction, receipt identity, migrations |
| Summit contract | Pair/resume/chat/stream/sync/ack/approval protocol fixtures |
| OpenClaw contract | Message adapter, live capability, finalizer, receipt, ingress ack policy |
| Fault injection | Relay loss, duplicate input, crash between dispatch/adoption, disk failure |
| Compatibility | Pinned minimum Gateway/plugin API, current stable, scheduled upstream canary |
| Packaging | Build output, `npm pack` contents, managed install, runtime inspect |
| Routing | Correct agent/account/session; cross-session and cross-agent isolation |
| Device | Lock, force-kill, network switch, push tap, exactly-once restored reply |

CI must pin stable supported OpenClaw versions. A scheduled test against upstream `main` is warning
only; it must never silently widen or move the published compatibility range.

## 13. Security requirements

- Treat the plugin as trusted in-process code: public source, minimal dependencies, explicit
  install/enable/allowlist, reproducible package inspection.
- TLS-only production relay, strict scheme/host configuration, frame allow-list and size limits.
- Connector token and pairing identity remain plugin-local and owner-readable only.
- Never log message content, approval command secrets, device tokens, or raw configuration.
- Validate every inbound frame before durable admission; bind it to the authenticated pairing and
  configured OpenClaw agent/account.
- Use stable opaque IDs at the relay. Push contains no transcript or command text.
- Design content-bearing frames for future app↔plugin E2E encryption.
- Do not use private OpenClaw internals to gain approvals or richer output; unsupported internal
  coupling is both a security and upgrade risk.

## 14. Risks and honest boundaries

- The OpenClaw plugin SDK moves quickly. Compatibility metadata and proof tests are core product
  work, not packaging polish.
- Approval resolution may not have a public channel-plugin seam. O0 determines whether it ships in
  the plugin's first release.
- Multi-agent routing makes mistakes more serious: output or approvals must never cross agents.
- Durable ingress is at-least-once around crash windows; stable idempotency and effect-once claims
  are required where side effects cannot repeat.
- The Gateway must remain running as a service. The plugin keeps Summit independent of the phone,
  not independent of OpenClaw itself.
- ClawHub/naming availability and any catalogue trust requirements must be confirmed before the
  stable install command is marketed.
- OpenClaw media support does not override Summit's Hermes-led v1 product constraints.

## 15. Definition of done

The OpenClaw plugin is done when a new user can install a tagged/package-verified release, select
an OpenClaw agent, pair in under two minutes, stream and finalize output without duplicates, use
only the controls honestly advertised by capability negotiation, lock/kill the phone during work,
and recover exactly one complete reply after reconnect—while maintaining agent/session isolation,
retaining pairing through normal Gateway upgrades, and storing no transcript in Summit's relay.

## Official references

Research was verified on 2026-07-19 against OpenClaw commit
[`6c9b31e`](https://github.com/openclaw/openclaw/commit/6c9b31e4d5604a82f2d9cfba64bb8a7cbb0e2de8).

- [Building OpenClaw plugins](https://docs.openclaw.ai/plugins/building-plugins)
- [Building channel plugins](https://docs.openclaw.ai/plugins/sdk-channel-plugins)
- [Plugin SDK entry points and registration modes](https://docs.openclaw.ai/plugins/sdk-entrypoints)
- [Plugin installation, trust, and sources](https://docs.openclaw.ai/tools/plugin)
- [Plugin manifest](https://docs.openclaw.ai/plugins/manifest)
- [Plugin SDK testing](https://docs.openclaw.ai/plugins/sdk-testing)
