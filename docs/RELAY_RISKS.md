# Relay Risk Register

Known failure modes in the relay stack (connector + DO + app client). Ordered by severity.

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

**Status:** Open

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

**Status:** Open

---

## P2 — Wrong error copy for relay outage

**File:** `src/agents/relay/errors.ts:17`
**Risk:** Misleads users into restarting their connector when the relay itself is down

`relay_unreachable` fires when the socket to `relay.summitapp.dev` fails to open — i.e. a Summit relay outage. The current message says "Agent disconnected. Check that the connector is running" — blaming the user's connector when the problem is our server.

**Fix:** Separate the copy:
- Socket open failure → "Can't reach Summit relay. Check your internet connection."
- `peer_gone` during pair → "Agent disconnected. Restart the connector."

**Status:** Open

---

## Low — `sendPush` has no timeout

**File:** `relay/src/channel.ts:106`
**Risk:** Slow Expo Push API response blocks WebSocket message dispatch for that DO

`sendPush` fires a `fetch` to `exp.host` with no timeout. If the Expo Push API is slow, the `dispatch` loop for that Durable Object stalls, delaying all subsequent connector/app frames for that pairing channel.

**Fix:** Wrap the fetch in a `Promise.race` with a 5s timeout.

**Status:** Open
