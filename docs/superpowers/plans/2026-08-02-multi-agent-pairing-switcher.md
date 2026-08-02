# Multi-agent pairing + switcher

## Problem

Users who run more than one agent self (Dane runs two–three Hermes instances) have no way to pair a
second agent or move between paired agents inside Summit. Today the app supports exactly one agent at
a time in practice, even though nothing in the data model requires that. This is also a competitive
gap — multi-agent switching is a feature people ask about, and losing it loses users at the door.

## Proposal

**This is not a new feature to build so much as a UI surface to expose one.** The agent/session/secret
model was already built multi-agent-capable (see Assumptions/Source-of-truth below) — `agents: Agent[]`,
per-agent Keychain secrets, per-agent adapters, sessions scoped by `agentId`, and a `selectAgent(id)`
already wired into `AgentProvider`. Nothing about pairing a second Hermes/OpenClaw instance requires
touching the relay, the connector, or the data layer. What's missing is entirely in `src/app/(app)/`:

1. **A way back into `/pair` after the first agent exists.** Today `AgentGuard` in `_layout.tsx` only
   routes to `/pair` when there is *no* active agent — nothing links there once you're paired. Add an
   "Add another agent" row (Settings, or a new item in the sidebar's account area) that pushes to
   `/pair` regardless of `activeAgent`. `pair.tsx`'s `handlePair` already calls `addAgent(...)`, which
   appends to the list and makes the new agent active — that's exactly the desired behavior (pairing
   a second agent switches you into it immediately, matching "ask your agent for a code" as the
   mental model for *any* agent, not just the first).
2. **An agent switcher.** Simplest real v1: a new section at the top of the existing `Sidebar` (the
   same drawer that already lists chat groups and shows `sidebarTitle`/`sidebarSubtitle` for the
   active agent) — one row per paired agent, name + framework label + a connection dot, sorted by
   `lastUsedAt` (the registry already exposes this via `sortByRecent`). Tapping a row calls the
   existing `selectAgent(id)` and closes the sidebar. The chat-loading `useEffect`s in `index.tsx`
   already key off `activeAgent` and re-run `repo.listSessions(activeAgent.id)`, so switching agents
   already reloads the right session list and reconnects the right adapter — no new plumbing there.
3. **Per-agent management.** `account.tsx` currently only reads `agents` to bulk-wipe on account
   deletion; it has no per-agent list UI. Give each paired agent a row (rename / remove / view
   connection) — `renameAgent`, `removeAgent`, and the `connection.tsx` repair flow already exist,
   they're just wired to `activeAgent` singularly. This can reuse `connection.tsx`'s pattern per agent
   id instead of always the active one.

**Recommended v1 scope:** items 1 and 2 only (pair a second agent, switch between them from the
sidebar). Item 3 (rich per-agent management) is a natural fast-follow, not a blocker — `account.tsx`'s
bulk remove-on-delete keeps working either way, and a user can still rename/remove via the existing
single-agent `connection.tsx` screen by switching to that agent first.

**What this is *not*:** mixing two agents inside one conversation (one thread, two backends
answering). That's a materially different, much bigger feature — routing, merged streams, turn
attribution — and nothing in Hermes's or OpenClaw's API surface supports it (Hermes especially: one
server = one agent, stateless per-request). What Dane described ("switch between different Hermes
selves") matches *switching which agent a thread talks to*, not *co-mingling* — see Open questions.

## Assumptions

- "Multiple Hermes selves" means multiple separately-paired Hermes (or OpenClaw) instances, each with
  its own connector/plugin, its own pairing code, its own relay channel — not one Hermes process
  serving multiple agent identities. `FRAMEWORKS.md`'s "one server = one agent" constraint is about
  the latter and doesn't block this; our app already models each paired instance as an independent
  `Agent` row.
- Switching agents means switching *which agent's sessions you're viewing/chatting in*, session state
  and history staying fully separated per agent (already true — `ChatSession.agentId`,
  `repo.listSessions(activeAgent.id)`). Not a merged/group-chat view.
- Re-pairing flow (`/pair` a second time) reuses the exact same relay pairing handshake as the first
  pair — nothing server-side treats "second pairing from the same device" specially. Reasonable given
  `relay/src/logic.ts`'s channel state is keyed per pairing code/Durable Object, not per device.

## Tradeoffs considered

- **Top-level tab/switcher (separate from the sidebar) vs. sidebar section** — a dedicated agent
  switcher (e.g. a top bar avatar stack like Slack workspaces) is more discoverable but is new visual
  chrome in a product whose whole positioning is "invisible, just chat" (per `CLAUDE.md`'s
  positioning note and the "clean simple UI" preference). Putting it in the sidebar, which is already
  the "everything about this agent" drawer, costs zero new chrome for the common one-agent case —
  users who only ever pair one agent never see it. Recommended.
- **Auto-switch on pair vs. asking "keep both connected / which is active"** — auto-switching (what
  `addAgent` already does) is simplest and matches the existing single-agent pairing UX exactly; no
  new decision surfaced to the user mid-pair. Recommended; a "switch to it now?" confirmation would be
  friction for no real benefit.

## Affected areas

- `src/app/(app)/_layout.tsx` — no change needed to the redirect guard itself (still correct: only
  force `/pair` when zero agents), but confirm nothing else assumes `agents.length <= 1`.
- `src/app/(app)/pair.tsx` — no logic change; may want a "Cancel" / back affordance when reached from
  Settings with an existing active agent, since `gestureEnabled: false` on this screen currently
  assumes it's an unskippable first-run step.
- `src/ui/chat/Sidebar` (wherever the sidebar component lives, rendered from `index.tsx`) — add an
  agents section: list `agents` (from `useAgents()`), highlight `activeAgent.id`, `onPress` →
  `selectAgent(id)`.
- `src/app/(app)/settings.tsx` or `account.tsx` — add "Add another agent" entry point routing to
  `/pair`.
- `src/app/(app)/account.tsx` — optional (fast-follow): per-agent list instead of only bulk-wipe.
- No changes expected in: `relay/`, `connector/`, `protocol/`, `src/agents/registry.ts`,
  `src/agents/AgentProvider.tsx`, `src/agents/secrets.ts`, `src/db/` — all already agent-list-shaped.

## Source of truth referenced

- `src/agents/types.ts`, `registry.ts`, `AgentProvider.tsx`, `secrets.ts` — confirmed the data model,
  persistence, and secret storage are already `Agent[]`-shaped with per-agent Keychain entries,
  per-agent adapters, and a working `selectAgent`/`resolveActive`. This is what makes the feature
  small.
- `FRAMEWORKS.md` — confirmed "one server = one agent" is a per-instance constraint, not a
  per-app-install limit; doesn't block pairing multiple instances.
- `CONNECTION.md` / `relay/src/logic.ts` — confirmed pairing state is scoped per pairing
  code/Durable-Object channel, not per device, so a second pairing doesn't collide with the first.
- `docs/TECHNICAL_REFERENCE.md`, `ONBOARDING.md`, `CLAUDE.md` positioning note — confirmed relay-mode
  pairing is the primary path and that the product's differentiation is the fluent flow, not chrome;
  informed the "sidebar, not a new tab" recommendation.

## Open questions for Dane

1. **Scope check on "within a conversation."** Does "switch between agents in a conversation" mean (a)
   switch which agent a *new* message goes to, from the chat screen, without leaving to the sidebar —
   i.e. a lighter-weight switcher than the sidebar list — or (b) something closer to true multi-agent
   in one thread? This plan assumes (a)-adjacent (sidebar switch, separate sessions per agent). If you
   want a faster in-chat switch (e.g. a chip next to the header agent name, no sidebar detour), that's
   a small addition on top of this plan, not a different plan.
2. **Push notifications across multiple paired agents** — worth a real device check once built:
   confirm the relay can deliver a push tied to the correct agent's channel when more than one agent
   is paired to the same device, so a notification opens the right agent/session (not just the last
   active one).

## Handoff to builders

Done looks like:
- From a state with one paired agent, a user can reach `/pair` again (via a new entry point) and pair
  a second Hermes/OpenClaw instance without losing or disturbing the first agent's sessions/secret.
- After pairing agent #2, the app is showing agent #2's (empty) session list; agent #1's sessions and
  message history are untouched and reachable again via the switcher.
- The sidebar shows both agents, highlights the active one, and tapping the inactive one switches
  `activeAgent`, reloads that agent's session list, and reconnects its adapter — verified by sending a
  message on each and confirming it lands in that agent's own history, not the other's.
- Removing one paired agent (existing `removeAgent`) does not affect the other's Keychain secret or
  sessions.
- `npx tsc --noEmit` and `npm test` green (the standing bar per `docs/TECHNICAL_REFERENCE.md`).

## Handoff to tester

- Run the standard pairing loop from `docs/TESTING.md` twice in sequence against two different mock
  agents / two real Hermes instances, confirming the second pair doesn't disturb the first agent's
  relay channel or push registration.
- Exercise the switcher: send a message to agent A, switch to agent B, send a different message,
  switch back to A — confirm no cross-talk in session history or in-flight streaming state.
- Background/foreground and kill/relaunch with two agents paired — confirm `resolveActive` picks the
  last-active agent on cold start (already covered by existing logic, but now exercised with >1 row
  for the first time).
- If push is in scope for this pass: trigger a completion on the *inactive* agent while the app is
  backgrounded, confirm the push opens the correct agent/session.
