# Summit for Hermes — Complete Build Plan

_Status: implementation started 2026-07-19. The standalone source now lives in the independent
working copy `../Summit-Hermes/`, connected to `SummitAI-app/Summit-Hermes`._

## 1. What the Hermes plugin is

The Summit Hermes plugin is a native **messaging platform adapter**. To Hermes, Summit behaves like
Telegram, Discord, or Slack. To Summit, the plugin behaves like the current connector: it opens an
outbound WebSocket to the relay, pairs the user's phone, accepts mobile messages, and delivers rich
agent output.

```text
Summit app
    │ chat / approvals / sync
    ▼
Cloudflare relay (route only)
    │ persistent outbound WSS
    ▼
SummitPlatformAdapter (inside `hermes gateway`)
    │ MessageEvent / send_draft / edit / send
    ▼
Hermes GatewayRunner → AIAgent → tools/model/memory
```

This removes the local Hermes API hop and API key from the recommended path. The plugin calls
Hermes through its in-process platform interface, not through `localhost:8642`.

## 2. Why this is the correct Hermes extension point

Hermes' official third-party path is a `kind: platform` plugin registered with
`ctx.register_platform()`. The adapter extends `BasePlatformAdapter`, receives inbound messages
through `self.handle_message(event)`, and implements outbound delivery methods. Hermes handles
configuration discovery, gateway lifecycle, session keying, commands, cron routing, status,
authorization, and agent execution.

The current upstream base adapter also exposes the specific seams Summit needs:

| Summit need | Hermes seam |
|---|---|
| Start/stop with the agent | `connect()` / `disconnect()` |
| Submit a phone message | Build `MessageEvent`, call `handle_message()` |
| Final response | `send()` |
| Live response | `supports_draft_streaming()`, `send_draft()`, `edit_message(..., finalize=...)` |
| Busy state | `send_typing()` and optional status text |
| Background/proactive result | `supports_async_delivery = True`, normal `send()`, cron home channel |
| Stop/reset commands | Hermes' normal platform command handling |
| Approval presentation | Platform confirmation methods plus approval hooks; prove exact mapping in Milestone H0 |

Do not implement Summit as only a general lifecycle hook. Hooks are useful observers but a platform
adapter is what gives Hermes a durable inbound/outbound channel and correct session ownership.

## 3. Source hosting and install experience

### Repository

Create a public company-owned repository:

```text
github.com/SummitAI-app/Summit-Hermes
```

Use protected `main`, required CI, signed release tags, two maintainers minimum, dependency update
automation, security reporting, CODEOWNERS, a release checklist, and an MIT licence.

### Beta install

Pin beta users to a tag or commit. The intended stable command is:

```bash
hermes plugins install SummitAI-app/Summit-Hermes --enable
```

After install, the user runs the plugin setup command or `hermes gateway setup`, starts/restarts the
gateway, and receives a six-digit Summit pairing code. Exact CLI ergonomics should be validated in
the H0 spike; do not invent a second installer if native Hermes setup is sufficient.

Hermes also discovers pip entry points under `hermes_agent.plugins`. Add PyPI only if Git installs
produce material upgrade/support friction; GitHub is enough for beta and keeps the trust chain easy
to inspect.

## 4. Standalone repository structure

```text
summit-hermes/
  README.md                       install, pair, update, remove, troubleshoot
  LICENSE
  SECURITY.md
  CONTRIBUTING.md
  CHANGELOG.md
  pyproject.toml                  package metadata + Hermes entry point
  plugin.yaml                     name, kind=platform, version, config prompts
  __init__.py                     required Hermes directory-plugin entry point
  summit_hermes/
    __init__.py
    config.py                     validated relay URL, limits, paths
    platform.py                   BasePlatformAdapter implementation
    relay_client.py               WSS state machine, heartbeat, reconnect
    protocol.py                   strict v1 frame encode/decode
    storage.py                    owner-only identity + settled reply outbox
    turns.py                      request/session and cumulative-draft correlation
    plugin.py                     register(ctx) and platform configuration hooks
  tests/
    _fake_hermes.py               public Hermes contract stand-ins for unit tests
    test_config.py
    test_platform.py
    test_protocol.py
    test_storage.py
    test_turns.py
  docs/
    ARCHITECTURE.md
    THREAT_MODEL.md
  .github/workflows/
    ci.yml
```

The smaller first implementation is deliberate. `pairing.py`, `outbox.py`, and `output.py` did
not justify separate modules yet; their responsibilities fit cleanly in `storage.py`,
`platform.py`, and `turns.py`. Approval, diagnostics, shared v2 fixtures, release automation, and
durable inbound idempotency remain follow-on work rather than empty scaffolding.

Keep runtime dependencies small. Prefer Hermes' existing HTTP/WebSocket libraries when they are
part of its supported plugin environment; otherwise use one mature WebSocket client and document
why. Never vendor a second agent runtime.

## 5. Configuration and local storage

### Configuration exposed by `plugin.yaml`

| Setting | Required | Default | Notes |
|---|---:|---|---|
| `SUMMIT_RELAY_URL` | No | `wss://relay.summitapp.dev` | Custom/self-hosted relay allowed |
| `SUMMIT_HOME_CHANNEL` | No | generated paired channel | Used for proactive/cron delivery |
| `SUMMIT_LOG_LEVEL` | No | `info` | Never logs content/tokens |
| `SUMMIT_STATE_DIR` | No | Hermes plugin state directory | Advanced override only |

There is no Hermes API key setting. The plugin is already inside Hermes. The relay connector token
is generated during first connection and written to an owner-only state file/database.

### Stored on the host

```text
connector identity/token      durable, secret, mode 0600 or equivalent
current pairing metadata      short-lived code metadata; code expires
settled reply outbox          bounded to 100 unacknowledged terminal replies
inbound idempotency records   bounded retention; prevents duplicate turns
protocol/plugin versions      non-secret diagnostics
```

Do not store the full live stream. Store only the settled structured result needed for reliable
replay, then delete it after the phone has persisted and acknowledged it. Encrypt the outbox at
rest when app↔plugin E2E is introduced; ciphertext can be replayed without the plugin retaining
plaintext.

## 6. Runtime state machine

```text
DISABLED
   │ plugin enabled + gateway starts
   ▼
CONNECTING ── failure ──> BACKOFF ── timer ──> CONNECTING
   │ WSS established
   ▼
UNPAIRED ── hello ──> CODE_AVAILABLE ── app pair ──> PAIRED
                                                │
                                     relay/network loss
                                                ▼
                                           RECONNECTING
                                                │ token resume
                                                ▼
                                              PAIRED
```

Use exponential backoff with jitter and a sensible cap, plus application heartbeats. A network
failure never disables the Hermes platform and never discards accepted input or settled output.
Fatal auth/protocol incompatibility should surface a clear `hermes status` diagnostic rather than
reconnecting forever.

## 7. Detailed flows

### A. Install and pair

1. Hermes installs the tagged GitHub plugin and records explicit enablement.
2. On `hermes gateway` startup, `register(ctx)` registers the `summit` platform.
3. `connect()` opens WSS to the configured relay and sends `hello` with protocol, plugin, Hermes,
   and capability versions.
4. Relay returns a single-use six-digit code and durable connector credential.
5. Plugin stores only the durable connector credential; it displays the code in a clear gateway
   log/status/setup surface.
6. User enters the code in Summit. Relay returns agent metadata and a device token.
7. Plugin records paired state and exposes a stable Summit chat identity.

Acceptance: the user never copies a host URL or Hermes API key, and restarting Hermes does not
require re-pairing.

### B. Phone message to Hermes

1. Plugin receives `chat` with `reqId`, Summit `sessionId`, stable input id, and text/inline-image
   content permitted by Hermes.
2. `ingress.py` durably records admission before execution.
3. The plugin maps the Summit session to a Hermes source/chat/thread identity and creates a
   `MessageEvent`.
4. It calls `handle_message(event)`; Hermes GatewayRunner owns authorization, commands, session,
   memory, tools, and the agent loop.
5. Duplicate input ids return the prior admission/result instead of starting a second turn.

Use one Summit pairing as one private Hermes platform user. Do not enable an `allow all users`
shortcut; the relay pairing credential is the identity boundary.

### C. Hermes output to Summit

1. `send_typing()` emits `status: running` without creating a chat message.
2. Draft streaming methods emit ordered `text_delta` or replaceable preview events.
3. Tool lifecycle data emits structured tool blocks, not prose mixed into assistant text.
4. `send(...final...)` or finalized edit creates one canonical settled message.
5. Plugin writes the settled message to the outbox before emitting `turn_finished`.
6. If the phone is online, events stream immediately. If absent, work continues and the relay
   receives only a content-free notification request.

The app must reconcile draft events into the same message ID and persist only the settled message.
Hermes' `send()` may be called for proactive delivery outside a phone-initiated request, so output
must also support a plugin-generated request/event ID and the configured home session.

### D. Phone closed, killed, or offline

1. Hermes and the plugin remain running on the host.
2. The accepted turn continues inside Hermes; the phone socket is irrelevant to execution.
3. Live deltas may be discarded after disconnect; the settled result is always retained locally.
4. Relay sends a generic push such as “Your agent finished” according to notification mode.
5. On reopen, Summit sends `sync_req`; the plugin replays every unacknowledged settled reply.
6. App transactionally persists and deduplicates by event ID, then sends `ack_replies`.

### E. Approval and stop

Hermes has more than one approval surface. The plugin must not fake a universal mapping.

- In H0, exercise a dangerous command through the gateway and identify the platform callback used
  for the prompt and resolution (`send_slash_confirm`, command reply, or another native seam).
- Map the native request to `approval_requested` with a stable approval ID, redacted command,
  description, and allowed decisions.
- Resolve from Summit through the native Hermes path. If the platform API only supports typed
  `/approve`/`/deny`, submit that as an authenticated platform command rather than bypassing policy.
- Map Summit Stop to Hermes' native `/stop`/interrupt path for the active session.
- Use `pre_approval_request` only for observation/notification unless upstream proves a supported
  resolver contract.

Gate the app UI on negotiated capabilities. If structured approval cannot be proven for a Hermes
version, the plugin still supports chat and presents the safe native typed-command fallback.

### F. Cron and proactive output

Register `cron_deliver_env_var`/home-channel support so scheduled Hermes jobs can target Summit.
Normal in-gateway cron delivery uses the live adapter. Only implement a `standalone_sender_fn` if
real deployments run cron in a separate process and the native documented hook is necessary.
Proactive results enter the same settled outbox and push flow as normal turns.

### G. Upgrade and rollback

1. Stop accepting new relay inputs during gateway shutdown.
2. Finish or durably retain admitted work according to Hermes shutdown behaviour.
3. Close WSS cleanly without deleting connector identity or outbox.
4. New version migrates local schema transactionally and resumes the existing relay credential.
5. Store a backward-readable schema for at least one stable version so rollback does not force
   re-pairing.

## 8. Output mapping

| Native observation | Summit event | App presentation |
|---|---|---|
| typing/busy | `status(running)` | Header/activity state |
| draft create/update | `text_delta` or `text_preview` | One growing assistant response |
| tool starts | `tool_started` | Collapsed tool row/block |
| tool progress | `tool_progress` | Updated row, no transcript spam |
| tool completes | `tool_finished` | Success/error state and safe summary |
| final send/edit | `text_final` | Settled markdown/code/table blocks |
| approval prompt | `approval_requested` | Action Request card |
| final delivery/outbox commit | `turn_finished` | Persisted completed turn |
| adapter/network/harness failure | `error` | Recoverable error state |

Phase H1 may ship text streaming + settled replay first, but the protocol and renderer must keep
structured tool/approval events separate from assistant text from day one.

## 9. Milestones and acceptance criteria

### Current implementation checkpoint (2026-07-19)

Built in the standalone tree:

- Native `kind: platform` registration and both supported Hermes discovery entry points.
- Validated TLS relay configuration, outbound WebSocket lifecycle, heartbeat, reconnect jitter,
  six-digit pairing, and durable connector identity.
- Authenticated owner-only `MessageEvent` ingress through Hermes' public adapter API.
- Native cumulative draft streaming converted to Summit deltas, canonical final delivery,
  proactive delivery, and a 100-item acknowledged settled-reply outbox.
- Atomic `0700`/`0600` local storage, strict 1 MiB protocol boundary, no token/content logging,
  public-facing architecture/threat-model/contribution docs, and Python 3.11–3.13 CI.
- 22 passing unit/contract tests plus clean Ruff lint/format, bytecode compilation, editable-package
  installation, and wheel-content verification.

Still required before beta:

- Run the adapter inside a real pinned Hermes gateway against a deployed/staging relay.
- Add connector/app protocol fixtures, duplicate inbound admission, revocation/re-pair UX, and
  relay-drop/disk-failure fault tests.
- Prove native stop/approval behavior instead of calling unstable Hermes internals.
- Complete rich structured output protocol work, clean-host install tests, release signing, and
  real-device background testing.

### H0 — API proof spike (2–4 engineering days)

- Minimal local Summit platform can connect, accept one message, stream/edit one response, and
  finalize it.
- Capture actual method metadata for text, tool progress, approval, stop, and proactive send.
- Confirm behaviour across the oldest Hermes version we intend to support and current `main`.
- Record any upstream gap before committing the public support matrix.

### H1 — Relay and chat skeleton (4–6 days)

- Native registration/configuration, WSS lifecycle, pairing/resume, chat ingress, text output.
- Protocol v2 fixtures passing.
- Clean install and restart retain pairing.

### H2 — Durability and background continuity (4–6 days)

- Durable ingress idempotency and settled reply outbox.
- Offline replay/ack, bounded retention, crash/restart recovery.
- Phone-off and gateway-restart test produces exactly one final response.

### H3 — Rich lifecycle and controls (4–7 days)

- Native draft streaming, status, structured tool progress.
- Approval and stop at the capability level actually proven in H0.
- Cron/proactive delivery and content-free push.

### H4 — Security, packaging, beta (4–6 days)

- Redaction, limits, dependency audit, upgrade/rollback migration.
- Linux/macOS clean-host matrix, signed tagged release, docs and diagnostics.
- Ten real-host beta installs and real-device background tests before “recommended” status.

Expected build: roughly **3–5 focused engineering weeks** after protocol v2 is settled. Approval or
streaming gaps in upstream Hermes could add time; H0 exists to expose that early.

## 10. Test matrix

| Layer | Required proof |
|---|---|
| Unit | Frame validation, config, redaction, state transitions, outbox bounds, migration |
| Contract | Shared pair/chat/stream/sync/ack/approval fixtures |
| Adapter | Hermes base-adapter behaviour, draft finalization, commands, proactive send |
| Fault injection | Relay drop, duplicate input, app drop mid-stream, disk failure, gateway restart |
| Compatibility | Pinned minimum Hermes, latest stable, current upstream smoke |
| Host | Linux x64/arm64 and macOS arm64; owner permissions checked |
| Device | Lock, force-kill, network switch, push tap, replay exactly once |

CI should test pinned supported Hermes releases. A scheduled canary may test upstream `main`, but a
failure there warns maintainers; it must not silently change the stable compatibility range.

## 11. Risks and honest boundaries

- Hermes evolves quickly; import paths and optional streaming/approval methods can change. Pin a
  minimum range, test it, and negotiate features rather than assuming them.
- In-process plugins have the same trust level as Hermes. Public source, minimal dependencies, and
  explicit enablement are mandatory.
- Live token deltas are less important than never losing the settled result. Durability wins when
  those goals conflict.
- Hermes still does not support general file upload. Summit may pass supported inline images only;
  the capability declaration must say so.
- One Hermes server remains one agent. Multiple Summit agents mean multiple Hermes installations/
  profiles and pairings, not a fake multi-agent layer inside the plugin.

## 12. Definition of done

The Hermes plugin is done when a new user can install a tagged public release, enable it, pair in
under two minutes, hold a streamed conversation, see accurate lifecycle output, safely respond to
supported approvals, lock/kill the phone during a turn, and recover exactly one complete response
after reconnect—without exposing a Hermes key, storing a transcript in the relay, or re-pairing
after a normal plugin/gateway upgrade.

## Official references

- [Adding a Hermes platform adapter](https://hermes-agent.nousresearch.com/docs/developer-guide/adding-platform-adapters)
- [Hermes plugin installation and discovery](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins)
- [Hermes event hooks and approvals observer](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)
- [Hermes gateway internals](https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals)
