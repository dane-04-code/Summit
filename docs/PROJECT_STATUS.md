# Summit — Current Delivery Status

_Last reviewed: 2026-07-21_

## The short version

Summit has crossed the connection-risk milestone. The native Hermes plugin is built in alpha, and the relay is working reliably in active use. V1 should now be finished as a focused mobile product: make chat output clear, turn the already-available harness signals into calm operational context, prove the important device paths, then publish.

The app is a mobile operator cockpit, not a terminal or a generic dashboard. The answer belongs at the centre; progress and automation results should be concise, safe, and easy to act on.

## What is real today

| Area | State | Release implication |
|---|---|---|
| Native Hermes plugin | Built, alpha | Native sessions, draft streaming, safe activity updates, reconnect, and durable settled replies exist. Prove them in ordinary daily use rather than extending the protocol speculatively. |
| Relay pairing and delivery | Working in active testing | Recent testing reports few disconnects. Maintain recovery tests, but do not spend V1 rebuilding transport architecture. |
| Mobile chat persistence | Built | Agents, sessions, and settled messages survive restart; secrets remain in Keychain. |
| Notifications | Built in app/relay | Verify real APNs delivery, taps, permissions, and notification preference behaviour on physical devices. |
| Chat presentation | Active V1 work | Make output scan well on a phone: answer first, compact progress, readable markdown/code, and a stable composer. |
| Harness-derived output | Active V1 work | Use the existing streamed text and safe activity labels. Add one typed event only when it supports a proven user need, such as a compact cron result. |
| OpenClaw | Foundation only | The Go connector/protocol path exists; native OpenClaw support is not a V1 launch dependency. |
| iOS distribution | In progress | Production build 13 finished and was auto-submitted for App Store Connect/TestFlight processing. Confirm processing and run the release build on a real phone. |

## What V1 still needs

### 1. Finish the conversation surface

- Polish message hierarchy and spacing so the useful answer wins visually.
- Keep code/markdown readable without making normal text look like a developer transcript.
- Make activity informative but quiet: one plain-language line such as “Searching the web” or “Running a command,” never raw tool payloads.
- Keep the composer behaving like a normal native message field across short and multiline input.

### 2. Prove the plugin’s useful operational loop

Run the native Hermes plugin through a real sequence:

1. Pair and stream a normal reply.
2. Observe a safe activity update during useful work.
3. Background or restart Summit while a reply settles, then recover it exactly once.
4. Deliver one real scheduled/cron outcome into the relevant conversation and, when appropriate, notify the user without message content in the push payload.

If that test exposes a missing presentation primitive, add the smallest typed event or card that solves it. A `cron_run` summary is a reasonable candidate; a broad remote-card/UI system is not.

### 3. Release with evidence

- Confirm the TestFlight build has processed and installs cleanly.
- Execute pairing, reconnect, background, cold-start, push, notification-tap, and data-reset checks on real devices.
- Finish store copy, screenshots, privacy answers, and the TestFlight tester loop.
- Fix only issues that affect the core conversation or trust boundary, then submit V1.

## Explicitly not on the V1 critical path

- Replacing the working relay or inventing a third transport.
- A large plugin feature list, arbitrary remote UI, dashboards, or raw execution logs.
- Exposing chain-of-thought, tool arguments, environment data, or full terminal output.
- Native OpenClaw parity.

## Decision rule for new ideas

Build it during V1 only if it makes one of these three moments materially better: reading an answer, knowing whether the agent is usefully working, or acting on a time-sensitive agent result. Otherwise record it for after launch.

## Canonical documents

- [V1 launch plan](LAUNCH_PLAN.md)
- [Connection, storage, and persistence contract](../AGENTS.md)
- [Plugin connection plan](PLUGIN_CONNECTION_PLAN.md)
- [Physical-device test checklist](TESTING.md)
