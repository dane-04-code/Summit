# Summit V1 Launch Plan

_Last reviewed: 2026-07-21_

## Position

The connection foundation is built. Hermes has a native platform plugin in alpha, and the relay is reliable in active testing. V1 is now a product-finishing effort: a calm, trustworthy conversation surface plus a small amount of useful agent-operational context.

The release bar is not “every plugin feature imagined.” It is: a person can pair their agent, have a clear conversation, understand useful work-in-progress, receive an important result, recover after interruption, and trust what the app does with their data.

## Release sequence

### 1. Finish the chat surface

**Goal:** the conversation is easy to read and compose in on a phone.

- Answer-first visual hierarchy; activity never competes with the answer.
- Readable markdown and code treatment without unnecessary visual boxes.
- Stable single- and multi-line composer behaviour.
- Compact, plain-language streaming/activity state.
- Persisted transcripts that reopen in the correct session.

**Done when:** ordinary daily chat looks and behaves like a polished mobile messenger while retaining the agent-specific context people need.

### 2. Use the Hermes plugin where it helps the user

**Goal:** prove the built plugin delivers operational value rather than merely a connection.

- Stream replies and safe activity labels from a live agent.
- Recover one settled reply after backgrounding, restart, or reconnect without duplicates.
- Deliver one real scheduled/cron outcome to its originating conversation.
- Send an attention notification only when that result warrants it; push payloads remain content-free.

The existing text, activity, settled-reply, and replay paths are sufficient for this proof. If a real cron test needs clearer presentation, add the minimum typed summary event (for example `cron_run`). Do not create a general remote-card protocol.

**Done when:** the agent’s work feels present and dependable without making Summit feel like a log viewer.

### 3. Complete device and trust validation

**Goal:** prove the release build, not just the development build.

- Clean install, pairing, normal chat, and session restore.
- Background, termination, reconnect, and settled-reply recovery.
- Notification permission, delivery, preference modes, tap routing, and no-content payload verification.
- Authentication, account deletion, agent removal, and local-data reset.
- Accessibility pass for type scaling, contrast, tap targets, VoiceOver labels, and keyboard avoidance.

**Done when:** the test checklist is green on at least the intended iPhone/iOS versions and any failures have a bounded fix or an explicit launch decision.

### 4. TestFlight beta

**Goal:** collect focused real-world evidence.

- Confirm the production build processes in App Store Connect and installs from TestFlight.
- Start with a small tester group using their actual agents.
- Ask about three things only: pairing reliability, clarity of chat/activity output, and whether notifications/results arrive at the right time.
- Fix core trust and conversation failures; avoid expanding scope from isolated feature requests.

### 5. Publish V1

**Goal:** submit a truthful, complete app.

- Finalise App Store metadata, screenshots, support URL, privacy details, and review notes.
- Confirm the shipped Info.plist includes every required privacy purpose string.
- Submit the release once the V1 checklist and TestFlight evidence support it.

## Post-launch queue

- Native OpenClaw implementation after an independent SDK/API validation pass.
- More typed harness summaries only where repeated use proves their value.
- Rich attachments and native approval cards where framework support and real workflows justify them.
- Broader analytics, dashboards, or workflow-management concepts only after the core cockpit proves repeat use.

## Scope guardrail

For V1, build only what improves one of these: reading the answer, understanding safe progress, or acting on an important outcome. Connection architecture is no longer the primary project; polish and proof are.
