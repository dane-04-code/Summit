# OpenClaw — Next Steps Handoff

**Audience:** an agent picking this up cold. Read this top-to-bottom first; every claim links to the file that proves it. **Do not re-research the protocol** — it's already verified (see §"Source of truth").

## Where we are (done, on branch `build/first-pages`, pushed)

Phase 1 = **OpenClaw chat through the Go connector** is built, tested, committed (6 TDD commits `d3583f3`..`f25ed7b`). All in `connector/openclaw.go` + `connector/openclaw_test.go`, wired in `connector/main.go`. **No app-side changes** — OpenClaw already resolves to the messaging floor in `src/agents/frameworks.ts` (`defaultCapabilitiesFor`).

The connector, when run with `AGENT_FRAMEWORK=openclaw` + `OPENCLAW_WS_URL` + `OPENCLAW_TOKEN`:
- opens a persistent WS to the local Gateway, trusted-backend handshake (`gateway-client`/`backend` + shared token, **no Ed25519/pairing**),
- subscribes (`sessions.messages.subscribe`, param `key`), sends `chat.send` (`message`/`idempotencyKey`/`sessionKey`),
- translates gateway events → relay `chunk`/`done`/`error` frames the app already renders.

**Status of the tests: fixture-driven only.** They encode the traced frame shapes; nothing has ever run against a live OpenClaw Gateway. That is the single most important caveat.

## Source of truth (read these, don't re-derive)

- `docs/openclaw-adapter-research.md` — ✅ live-trace-verified protocol (handshake, params, event shapes, keepalive). Authoritative.
- `docs/superpowers/plans/2026-07-06-openclaw-connector-chat.md` — the Phase 1 plan that was executed.
- `FRAMEWORKS.md` §OPENCLAW — older high-level notes; **partially contradicts the trace** (see Task D).
- Memory: `openclaw-connector-phase1`, `local-go-toolchain`.

## Environment gotchas (will waste your time otherwise)

- **Go is installed but not on the bash PATH.** Prefix every Go command: `export PATH="/c/Program Files/Go/bin:$PATH"`. Run tests from `connector/`: `go test ./...`.
- The connector's Go tests historically ran **only in CI** (`.github/workflows/release-connector.yml`); the app is TS/RN.
- `origin` still points at the old repo URL (`agentchat`); GitHub redirects to the new `Summit` repo. Pushes work; consider `git remote set-url origin https://github.com/dane-04-code/Summit.git`.
- Watch disk space on C: — it ran near-full (~0.1 GB) and silently broke installs.

---

## Next steps, in priority order

### Task A — Validate Phase 1 against a live OpenClaw Gateway  ← DO THIS FIRST
**Why first:** everything downstream (and Phase 1 itself) rests on unverified fixtures. This is the gate before Phase 1 can ship.
**What:** stand up / get access to a real OpenClaw Gateway. Point a connector at it (`AGENT_FRAMEWORK=openclaw OPENCLAW_WS_URL=ws://localhost:18789 OPENCLAW_TOKEN=…`). Send a chat from the app (or `scripts/mock-agent.mjs`-style harness) and confirm a reply renders.
**Confirm specifically:** (1) Gateway WS **port is 18789** — the trace never restated it (open item #2). (2) The `connect`→`hello-ok` handshake succeeds with our backend identity and returns `operator.write`. (3) The assistant reply really arrives as a `session.message` with `role:"assistant"` + `content[].text`, and the turn closes with a `chat` `state:"done"` carrying our `runId`. (4) `tickIntervalMs` really is 30s.
**If any shape differs:** fix `translateEvent` / builders in `connector/openclaw.go` and the corresponding fixtures in `connector/openclaw_test.go`, keep tests green.
**Done when:** a real round-trip works end-to-end, and any corrections are committed.

### Task B — OpenClaw token sourcing + install flow
**Why:** Task A uses a hand-set `OPENCLAW_TOKEN`; real users won't. (Open item #3.)
**What:** decide where the connector reads the gateway shared token from on a real box (Hermes reads `~/.hermes/.env` — find OpenClaw's equivalent, likely its gateway config). Then extend the install path: the relay-served install script (`relay/src/install-script.ts`, served at `get.summitapp.dev/connect`) currently reads the Hermes key and sets Hermes env. Add an OpenClaw variant that detects the Gateway, reads its token, and exports `AGENT_FRAMEWORK=openclaw` + `OPENCLAW_WS_URL` + `OPENCLAW_TOKEN`.
**Done when:** `curl … | sh` on a box running OpenClaw produces a working, paired connector with no manual env editing.

### Task C — Phase 2: Approvals (the big one)
**Why:** approvals are a headline capability; OpenClaw supports them, and ours are currently Hermes-only.
**Key difference from Hermes:** Hermes approvals are **pull/REST** (app→connector `api_req` → `/v1/runs/{id}/approval`). OpenClaw **pushes** `exec.approval.requested` unsolicited over the persistent WS, and you resolve with an `exec.approval.resolve` call. So this needs a **new bidirectional relay frame pair**, not the existing REST path.
**Design sketch (write the full TDD plan after Task A validates the event shapes):**
- `protocol/protocol.ts` + connector `Frame` (`connector/main.go`): add
  - connector→app `approval_req` { approvalId, command, systemRunPlan }
  - app→connector `approval_resolve` { approvalId, decision: "approve"|"deny" }
- `connector/openclaw.go`: the persistent-WS read loop must be **demuxed** — right now `(*ocClient).chat` owns the socket read for the duration of a turn. Approval events can arrive anytime, so refactor to a single reader goroutine that dispatches: turn events → the active chat channel; `exec.approval.requested` → an `approval_req` frame to the app. Add `(*ocClient).resolveApproval(approvalId, decision)` → sends `exec.approval.resolve`. Map incoming `approval_resolve` frames to it.
- App: render the approval card from a pushed `approval_req` (not from polling). The card UI likely already exists for Hermes — check `src/ui/` and the run-approval wiring; reuse it, feed it the pushed event.
- `src/agents/frameworks.ts`: flip `hasRunApproval` (and maybe `hasRunStop`) on for `openclaw` in `defaultCapabilitiesFor`.
**Watch out:** the single-reader refactor in `openclaw.go` is the crux — the current `chat()` reading the socket directly will conflict with a shared reader. Do that refactor first, keep the Phase 1 chat test green throughout.
**Done when:** a pushed approval renders a card, approve/deny resolves it, and the suspended turn resumes — validated against the live Gateway.

### Task D — Reconcile the HTTP-endpoint doc conflict (small, do anytime)
**What:** the live trace says **both** `/v1/chat/completions` and `/v1/responses` are disabled by default; `FRAMEWORKS.md` §OPENCLAW claims chat-completions is available. Confirm against the live Gateway (Task A box) and fix whichever doc is wrong. Doesn't block anything — we build the WS path regardless — but our own docs currently disagree.

---

## Suggested order
A → (D opportunistically) → B → C. A unblocks and de-risks everything; C is the largest and should only be planned in detail once A confirms the event shapes it's built on.
