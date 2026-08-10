# Relay Risk Register

Known failure modes in the relay stack (connector + DO + app client). Ordered by severity.

This register records what was wrong and what was done about it. For how the resulting defences
work day to day — rate-limit budgets, the orphaned-channel reaper, connector backoff, and how to
verify each locally — see `docs/RELAY_ABUSE_CONTROLS.md`.

---

## P0 — Pairing code was too small to survive a distributed sweep

**Files:** `protocol/pairingCode.ts`, `relay/src/index.ts`, `relay/src/logic.ts`

**Risk:** The code was 6 digits — ~900,000 channels. The lockout that guards it
(`MAX_FAILED_PAIRS`) lives in *per-code* Durable Object state, so it only ever sees one channel
being hammered; an attacker spending a few guesses each across many codes never trips it. That
left roughly 5 free attempts × 900k channels, bounded only by the edge IP limiter, which rotating
IPs defeat. Winning the race against a live unpaired code yields the session token — i.e. full
control of an agent with shell access on the user's machine.

**Fix:**
- **40-bit codes.** Crockford base32 (no I/L/O/U), 8 characters ≈ 1.1e12 combinations. Minted
  without modulo bias — the old `random % 900000` was slightly skewed, which costs real keyspace.
- **Shorter window.** Code TTL 10 min → 3 min, and the deadline is now *sticky*: it is set at the
  first hello and never pushed forward, so a connector in a restart loop can no longer hold one
  code open indefinitely.
- **Rotation.** Connectors advertising the `code_rotation` capability fetch a fresh code when the
  window closes, so a short TTL never strands the user on a dead code. Connectors without it keep
  the 10-minute window rather than being stranded — the entropy, not the window, is what carries
  the security here.
- **Format gate before allocation.** `idFromName` on unvalidated input allocated a Durable Object
  per distinct string; locators are now regex-checked (400) before any DO is touched.
- **`claim` is throttled too.** The IP limiter previously covered only the app's `code` path, while
  `claim` reached the same channels unthrottled.
- **Constant-time credential compare.** `===` on tokens short-circuits at the first differing
  character, which is a prefix oracle.

**Migration:** none required. Legacy 6-digit codes remain valid *channel locators*, so installs
paired under the old scheme keep resuming; they are simply never minted again.

**Status:** Fixed ✅

---

## P0 — Privileged app frames were accepted before authentication

**Risk:** Anyone who reached a pairing channel could attempt chat, API, approval, or push-token
frames without first proving possession of the durable device credential.

**Fix:** Successful pairing now mints a 256-bit device token. The app stores the token with the
six-digit channel locator in Keychain, resumes with it on every connection, and the relay rejects
all privileged frames from unauthenticated sockets. Unauthenticated sockets cannot change app
presence or notify the connector when they close.

**Migration:** Development installs that stored only a six-digit code must pair once again; those
installs discarded the previously minted token, so there is no secure credential to migrate.

**Status:** Fixed ✅

---

## P0 — Connector reconnect used the six-digit pairing code

**Risk:** The short human-readable code was being reused as connector identity.

**Fix:** The relay now mints a separate 256-bit connector credential on first connection. The
connector stores it in a mode-0600 file and must present it when reclaiming its channel.

**Status:** Fixed ✅

---

## P1 — Unauthenticated Durable Object allocation via the no-locator mint path

**Files:** `relay/src/index.ts`, `relay/src/channel.ts`, `relay/wrangler.toml`

**Risk:** When a WebSocket upgrade arrives with neither `code` nor `claim`, the relay mints a new
pairing code and allocates a real Durable Object for it — the legitimate path a connector takes on
its very first connection. Two things made it abusable:

1. The `PAIR_LIMITER` IP throttle was gated on `locator !== null`, so it covered `code`/`claim` but
   not minting. Minting was reachable by anyone, with no authentication and no rate limit.
2. The allocation is not transient. `handleConnectorOpen` persists channel state
   (`relay/src/channel.ts`, the `storage.put` before `acceptWebSocket`) *before* any frame proves a
   real connector is on the other end, and nothing ever deleted it. An unpaired channel outlived its
   3-minute `CODE_TTL_MS` indefinitely.

So anyone able to complete a WebSocket handshake could leave persistent Durable Object storage
behind, one object per attempt, at whatever rate they liked. It needs an `Upgrade: websocket` header
rather than a plain HTTP probe, so commodity internet scanning does not stumble into it — but it
takes no skill to do deliberately, and the cost accrues to us.

**Fix, in two parts:**

- **Rate:** minting is now throttled per IP like the other paths. It uses its own `MINT_LIMITER`
  namespace (5 req/60s) rather than sharing `PAIR_LIMITER` — pointedly, so that a flood of anonymous
  mints cannot exhaust the budget a phone on the same IP needs to finish pairing. Real minting is
  rare: once at connector startup, then once per code rotation while nobody has paired.
- **Accumulation:** `PairingChannel` now arms a reap alarm when a connector socket opens, and its
  `alarm()` handler calls `deleteAll()` on any channel that is still unpaired with no sockets
  attached. The alarm is armed at open rather than at `hello` precisely because `codeExpiresAt` is
  only set once a hello arrives — a socket that connects and never speaks, which is the abuse case,
  would otherwise carry no expiry at all. Paired channels are never reaped; they hold the session
  and push tokens the app reconnects with.

Both connectors also back off exponentially (5s → 60s, with jitter, reset on a successful
connection) instead of redialling at a fixed 5s. A fixed rate meant a throttled connector could hold
its own IP over the limit indefinitely, including for the phone trying to pair from that network.

**Status:** Fixed ✅ — rate-limited *and* reaped. The limiter alone would only have capped the rate
of accumulation, not stopped it.

---

## P1 — Relay accepted unbounded or wrong-direction frames

**Risk:** Oversized or role-inappropriate frames could waste memory or reach unintended handlers.

**Fix:** The Durable Object closes frames over 1 MB, malformed JSON, and frame types not allowed
for the app/connector side.

**Status:** Fixed ✅

---

## P0 — Connector HTTP client has no timeout

**File:** `connector/hermes.go:44–45, 16`
**Risk:** Goroutine leak → OOM / slow connector under load

`http.DefaultClient` has no timeout. Every `handleChat` and `handleApiReq` call spawns a goroutine that blocks until Hermes responds. If Hermes hangs (slow tool, stuck run, network issue), the goroutine sits indefinitely. Each new user message spawns another. Over time the connector bloats and eventually crashes.

**Fix:** Replace `http.DefaultClient` with a client that has a 30s timeout. For streaming, add a cancellable context with a 5-minute cap.

```go
var httpClient = &http.Client{Timeout: 30 * time.Second}

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()
req = req.WithContext(ctx)
```

**Status:** Fixed ✅

---

## P1 — Scanner silently drops SSE lines over 64KB

**File:** `connector/hermes.go:58`
**Risk:** Truncated responses with no error shown to user

`bufio.NewScanner` defaults to a 64KB token buffer. A long Hermes `data:` line (large tool result, code dump, long response) causes `scanner.Scan()` to return `false` with `bufio.ErrTooLong`. The current code does not check the scanner error, so the truncated chunk is silently discarded — the user sees a cut-off response with no indication anything went wrong.

**Fix:**
```go
scanner := bufio.NewScanner(resp.Body)
scanner.Buffer(make([]byte, 1024*1024), 1024*1024) // 1MB limit
```

**Status:** Fixed ✅

---

## P2 — `chat()` generator has no timeout

**File:** `src/agents/relay/client.ts:138`
**Risk:** Infinite spinner if socket dies without a close event

`request()` has a 15s timeout. `chat()` does not. If Cloudflare drops the connection without firing a close event (e.g. DO crash during hibernation wake), the generator's `notify` callback is never called and the user's message UI hangs indefinitely showing a spinner.

**Fix:** Add a `setTimeout` fallback inside the generator loop that pushes `{ type: 'error' }` after ~120s of no frames on an active reqId.

**Status:** Fixed ✅

---

## P2 — `reqId` collision under rapid sends

**File:** `src/agents/relay/client.ts` (via `relay.ts:96`)
**Risk:** Two rapid sends within the same millisecond share a reqId; both generators receive both responses

`reqId` is `String(Date.now())`. Two messages sent in the same millisecond collide. The second response routes to both active chat generators, corrupting both streams.

**Fix:** Replace with a per-client counter:
```ts
private reqCounter = 0;
private nextReqId = () => `req-${++this.reqCounter}`;
```

**Status:** Fixed ✅

---

## P2 — Wrong error copy for relay outage

**File:** `src/agents/relay/errors.ts:17`
**Risk:** Misleads users into restarting their connector when the relay itself is down

`relay_unreachable` fires when the socket to `relay.summitapp.dev` fails to open — i.e. a Summit relay outage. The current message says "Agent disconnected. Check that the connector is running" — blaming the user's connector when the problem is our server.

**Fix:** Separate the copy:
- Socket open failure → "Can't reach Summit relay. Check your internet connection."
- `peer_gone` during pair → "Agent disconnected. Restart the connector."

**Status:** Fixed ✅

---

## Low — `sendPush` has no timeout

**File:** `relay/src/channel.ts:106`
**Risk:** Slow Expo Push API response blocks WebSocket message dispatch for that DO

`sendPush` fires a `fetch` to `exp.host` with no timeout. If the Expo Push API is slow, the `dispatch` loop for that Durable Object stalls, delaying all subsequent connector/app frames for that pairing channel.

**Fix:** Cancel the fetch with an `AbortController` after 5 seconds.

**Status:** Fixed ✅
