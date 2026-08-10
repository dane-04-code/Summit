# Relay Abuse Controls

How the relay protects itself from unauthenticated traffic: what each control does, why it is
shaped the way it is, and how to verify or tune it. `RELAY_RISKS.md` records *what was wrong*;
this records *how the defences work now*, for whoever next touches `relay/src/index.ts`,
`relay/src/channel.ts`, or the redial loops.

Established 2026-08-10.

---

## The thing that makes the relay attackable

Every WebSocket upgrade the relay accepts costs it a Durable Object.

`relay/src/index.ts` routes an upgrade three ways: `?code=` (the app joining an existing channel),
`?claim=` (a connector reclaiming its own channel), or neither — the mint path, where a connector
gets its first code. All three end in `PAIRING_CHANNEL.get(id).fetch(...)`, and the DO's
`handleConnectorOpen` calls `storage.put('state', …)` *before* `acceptWebSocket` and before any
frame has proved who is on the other end.

Two consequences worth internalising:

- **`idFromName` on arbitrary input allocates.** This is why the `isChannelLocator` regex gate sits
  ahead of everything else — a malformed locator must be rejected before it can name an object.
- **The mint path needs no credential at all.** It cannot: a first-time connector has nothing to
  present. So its only protections are the ones below.

## Control 1 — Two separate rate-limit budgets

`relay/wrangler.toml` declares two Cloudflare rate-limit bindings, both keyed on `CF-Connecting-IP`:

| Binding | Namespace | Limit | Covers |
|---|---|---|---|
| `PAIR_LIMITER` | 1001 | 20 / 60s | upgrades naming a channel (`code`, `claim`) |
| `MINT_LIMITER` | 1002 | 5 / 60s | upgrades naming nothing (the mint path) |

**Why two and not one.** A single shared bucket means anonymous mint traffic can spend the
allowance a real phone needs to pair. On a shared or CGNAT'd IP that converts a nuisance into a
denial of the actual product. Keep them separate; if you ever collapse them, that regression is
pinned by *"lets a phone pair while the mint budget is exhausted"* in
`relay/src/__tests__/index.test.ts`.

**Why 5/60s is enough for minting.** A connector mints once at startup, then once per code rotation
while nobody has paired — `CODE_TTL_MS` is 3 minutes (`relay/src/logic.ts`), so ~20/hour steady
state.

**Ordering inside `fetch` matters** and is test-pinned:

1. non-WebSocket request → plain 200, no token spent (keeps health checks free)
2. malformed locator → 400, no token spent (rejecting garbage must stay cheap)
3. *then* the limiter for whichever path applies

**Fail-open.** Both bindings are optional in `Env`. Absent means no throttle — that is what makes
`wrangler dev` and the unit tests work. Do not "fix" this by making them required.

## Control 2 — The reaper

Rate limiting caps how *fast* orphaned Durable Objects appear. Nothing about it stops them
accumulating: at 5/60s, one IP can still leave thousands of persisted objects per day, and a DO's
storage lives until something deletes it.

`PairingChannel` (`relay/src/channel.ts`) therefore arms an alarm when a connector socket opens and
deletes the channel if it never became a real pairing.

```
connector open ──> storage.put('state') ──> setAlarm(now + REAP_AFTER_MS)   [if unpaired]

alarm() ──> paired?              ──> return, do not re-arm   (holds session + push tokens)
       ──> any socket attached?  ──> re-arm for another window
       ──> otherwise             ──> storage.deleteAll()
```

`REAP_AFTER_MS` is 15 minutes: past `LEGACY_CODE_TTL_MS` (10 min) so a legacy connector's pairing
window is never cut short.

**The one detail that is easy to get wrong.** Arm at *open*, not at `hello`. `codeExpiresAt` is only
set when a hello frame arrives (`relay/src/logic.ts`), so keying the reaper off it would leave the
abuse case — a socket that connects and never speaks — with no expiry at all. Anything that reworks
the reaper must preserve this.

Idle sockets resolve themselves into the reap path: Cloudflare's idle timer drops a connection that
sends no JSON, which fires `webSocketClose`, which leaves no attached sockets for the next alarm.

## Control 3 — Connector backoff

A fixed retry interval lets a throttled connector hold its own IP over the limit forever, including
for the phone trying to pair from that network. Both connectors back off instead:

| | Go connector | OpenClaw plugin |
|---|---|---|
| Implementation | `connector/backoff.go` | `relay-client.ts`, `scheduleReconnect` |
| Range | 5s → 60s, doubling | same |
| Jitter | `[d, 1.25d)` | same |
| Reset | `run()` reports it connected | `ws.on('open')` |

**Reset on a successful connection, not on a successful *session*.** Code rotation deliberately
closes a live socket to fetch a fresh code; if that counted as a failure the user would watch their
pairing code refresh more and more slowly.

The jitter exists for one specific event: a relay deploy drops every connector's socket at the same
instant, and without it they would all return at the same instant.

---

## Verifying it locally

Alarms and rate limits both work under `wrangler dev`, so none of this needs a deploy.

```sh
cd relay && npx wrangler dev --port 8799
```

**Rate limits** — a raw upgrade needs the handshake headers or the Worker returns its plain 200:

```sh
ws () { curl -s -m 3 -o /dev/null -w "%{http_code}\n" \
  -H "Upgrade: websocket" -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13" \
  "http://127.0.0.1:8799/$1"; }

for i in $(seq 1 10); do ws; done          # 101 ×5, then 429 — MINT_LIMITER
ws "?code=K7M29XQP"                        # still 101 — separate budget
ws "?code=not-a-code"                      # 400, no token spent
```

**The reaper** — inspect the local DO storage directly. Each object is one SQLite file under
`relay/.wrangler/state/v3/do/summit-relay-PairingChannel/`; copy them before reading, since workerd
holds the WAL:

```sh
D=relay/.wrangler/state/v3/do/summit-relay-PairingChannel
mkdir -p /tmp/doinspect && cp "$D"/*.sqlite* /tmp/doinspect/
sqlite3 /tmp/doinspect/<object>.sqlite 'select key from _cf_KV;'    # [state] before, [] after
sqlite3 /tmp/doinspect/metadata.sqlite 'select count(*) from _cf_ALARM;'
```

A freshly minted orphan shows `keys=[state]` and one scheduled alarm; after the window both are
empty. The whole `.wrangler/` directory is gitignored and disposable — delete it for a clean
baseline.

Waiting 15 minutes per iteration is tedious. Temporarily lowering `REAP_AFTER_MS` to `10_000`
exercises the identical alarm plumbing in seconds — just revert it before committing, and re-run
`npx vitest run` afterwards.

## Test coverage

| File | Pins |
|---|---|
| `relay/src/__tests__/index.test.ts` | limiter selection per path, budget independence, ordering (400 and non-WS spend nothing) |
| `relay/src/__tests__/channel.test.ts` | alarm armed at open; reap when unpaired and socketless; never reap a paired channel; re-arm while a socket is attached |
| `connector/backoff_test.go` | doubling, ceiling clamp, reset behaviour, jitter bounds |
| `openclaw-plugin/src/relay-client.test.ts` | backoff growth across failed dials, reset after a success |

The channel tests hand-roll a `DurableObjectState` (Map-backed storage, `setAlarm`/`deleteAll`
spies) rather than pulling in a workerd harness, matching the style of the other relay tests. Two
workerd-only behaviours have to be worked around there, and both are noted in the file: `Response`
with status 101 is rejected by Node, and `blockConcurrencyWhile` does not actually block, so the
constructor's state load must be awaited before driving the object.

## If you are tuning these

- **Limits** live in `relay/wrangler.toml` and take effect on deploy. Raising `MINT_LIMITER` is
  usually the wrong move — a legitimate connector needs single digits per hour, so pressure there
  means something is redialling too hard, which is Control 3's problem.
- **`REAP_AFTER_MS`** must stay above `LEGACY_CODE_TTL_MS`.
- **The paired-channel guard in `alarm()` is load-bearing.** A paired channel holds `sessionToken`
  and `pushToken`; reaping one silently breaks resume and push for that user.
