# Summit Artifacts — V2 Product and Technical Plan

**Status:** V2 concept; do not pull into MVP before real-device beta validation
**Product thesis:** Your self-hosted agent should be able to build you a small private tool, place it
in Summit, and keep improving it through conversation.

## Verdict

Build this in V2, but do not begin with arbitrary React apps downloaded into the iPhone.

The compelling version of Summit Artifacts is not a gallery or a clone of Claude's publishing
platform. It is a private workshop for technical self-hosters:

> Ask your agent to build a tool. Open it beside the conversation. Use it. Point at what should
> change. Let the same agent revise it.

This fits Summit unusually well because the user's agent already has tools, files, memory, and
access to the user's own server. Claude's model proves that conversation can produce reusable apps,
documents, sites, SVGs, diagrams, and interactive components. Summit's opportunity is different:
the artifact can remain owned by—and operationally connected to—the user's self-hosted agent.

## The product idea

A Summit Artifact is a named, versioned micro-tool attached to one agent. It has four parts:

1. **Source** — code or declarative UI authored by the agent on its own host.
2. **View** — the safe UI that Summit renders on the phone.
3. **Actions** — a small allow-listed set of things the artifact may ask Summit or the agent to do.
4. **State** — bounded data owned by the agent host, not by the hosted relay.

Artifacts can be useful while offline if they are purely interactive, and become agent-powered when
connected. The relay transports artifact frames but never becomes an artifact hosting platform or
content database.

## The signature experience

```text
User: "Build me a release cockpit for this server."
  ↓
Agent asks two useful questions, then writes and validates the artifact
  ↓
Chat receives:  Release Cockpit · v1 · Ready to open
  ↓
User opens a full-screen, mobile-native tool
  ↓
User taps "Check deploy" or "Restart worker"
  ↓
Summit shows the exact agent action and approval boundary
  ↓
User taps "Edit with agent" and says: "Put failed jobs first"
  ↓
Agent publishes v2; v1 remains available for rollback
```

The user does not manage a repository, package manager, build command, or deployment target unless
they choose to inspect them. The agent does the coding; Summit makes the result safe and usable.

## Where it lives in Summit

Artifacts should extend the existing three-surface product rather than add a new tab bar:

- **Chat:** an inline `artifact` card appears when an agent creates or updates one.
- **Artifact viewer:** a focused full-screen surface with Back, title, connection state, version,
  Share/Export where applicable, and **Edit with agent**.
- **Drawer:** an **Artifacts** section under the active agent, beside recent sessions.

An artifact belongs to an agent, not globally to the account. This respects Hermes's one-server-one-
agent model and prevents accidental cross-agent access.

## What users could build

The first examples should feel native to Summit's technical self-hoster audience:

- a deployment or service-health cockpit;
- a cron/runbook editor with guarded actions;
- a log triage explorer with filters and an "Ask agent about this" action;
- a cost/usage dashboard generated from local provider logs;
- a research evidence board that preserves sources and agent notes;
- a database query form backed by an agent-owned, read-only action;
- a configuration wizard that produces a reviewed patch;
- a calculator, tracker, checklist, diagram, or small game that works offline.

Avoid leading with generic templates or a public gallery. The magic is **my agent built my tool from
my environment**, not another mini-app marketplace.

## Runtime strategy: two layers

### 1. Artifact Canvas — build this first

The agent writes against a small, versioned Summit Artifact SDK. The output is validated declarative
data, not arbitrary executable code. Summit renders it with native components already shipped in the
app.

Initial components:

- stack, grid, tabs, section, text, markdown and image;
- button, text field, select, toggle and date input;
- table, metric, progress, badge and log viewer;
- line/bar/pie charts and simple diagrams;
- local variables, formulas, filters and conditional visibility;
- declared agent actions.

The agent can still *code* the artifact—for example in TypeScript using a typed builder—but the
build step emits a bounded JSON component tree. The phone never evaluates that TypeScript.

Why start here:

- native controls feel good on a phone and remain accessible;
- the runtime can be exhaustively validated and size-limited;
- offline behavior is predictable;
- artifacts cannot access cookies, arbitrary networks, the filesystem, or native APIs;
- it is much easier to explain during App Review as user-authored data rendered by fixed app
  functionality.

### 2. Artifact Lab — a gated later slice

Artifact Lab renders self-contained HTML/CSS/JavaScript for experiences the Canvas cannot express.
It should ship only if a dedicated App Store and security spike passes.

If approved, the web runtime must use:

- a dedicated `WKWebView`/WebView process and a non-persistent website data store;
- no ambient cookies, relay token, agent key, account token, or native bridge;
- network access denied by default, with navigation intercepted by Summit;
- a strict Content Security Policy and no remote scripts/CDNs;
- one immutable bundle per version, addressed by a content digest;
- a tiny, schema-validated message bridge for declared actions only;
- hard limits on bundle size, runtime messages, CPU time where possible, and stored state;
- a visible source view, reset control, and kill/reload action.

Apple currently prohibits downloaded code that changes app functionality under Guideline 2.5.2,
while Guideline 4.7 permits HTML5/JavaScript mini apps subject to substantial catalog, privacy,
moderation, age-rating, and API restrictions. Treat approval as an explicit product gate, not an
implementation detail.

## Agent-powered artifacts without giving code secrets

Artifacts must never receive the Hermes API key, relay credential, Supabase session, or unrestricted
native access. They communicate through declared capabilities:

```json
{
  "permissions": [
    "artifact.state.read",
    "artifact.state.write",
    "agent.action:check_deploy",
    "external_link.open"
  ]
}
```

Recommended action model:

1. The artifact emits `{ actionId, input }`.
2. Summit validates that the action is declared in the manifest.
3. Summit shows a human-readable confirmation when the action can mutate external state.
4. The app sends a structured request through the normal agent adapter.
5. The agent/plugin runs the handler using its existing tools and approval policy.
6. The result returns as data and, when useful, as a linked chat turn.

This keeps Summit's strongest product principle intact: the user retains calm authority near the
approve/stop boundary.

## Artifact package

The initial wire format should be framework-agnostic and capability-gated:

```json
{
  "schemaVersion": 1,
  "id": "release-cockpit",
  "version": 3,
  "title": "Release Cockpit",
  "description": "Health and guarded deploy actions for this host",
  "entry": { "kind": "canvas", "document": "canvas.json" },
  "permissions": ["agent.action:check_deploy"],
  "offline": "read-only",
  "digest": "sha256:...",
  "createdAt": 1784500000000,
  "createdBy": { "agentId": "...", "sessionId": "..." }
}
```

Design rules:

- immutable versions; publishing an edit creates `version + 1`;
- stable artifact ID so chat cards always open the latest compatible version;
- digest verification before rendering;
- source view available to the user;
- no secrets or user data embedded in the package;
- package size initially capped around 512 KiB;
- state schema and migrations are explicit and separately versioned.

## Storage and privacy

```text
Agent host (source of truth)
  ~/.summit/artifacts/<artifact-id>/
    manifest.json
    versions/<n>/canvas.json or bundle.html
    source/
    state.json or an artifact-owned SQLite DB
             │
             │ opaque, authenticated artifact frames
             ▼
Hosted relay (no persistence)
             │
             ▼
Phone
  SQLite: artifact metadata, version pointers, chat-card references
  app filesystem: verified immutable bundle cache
  Keychain: unchanged; credentials only
```

The artifact's durable state lives beside the agent because that is where its tools and data live.
The phone may cache a safe snapshot for fast/offline opening. The hosted relay must not store source,
bundles, state, or interaction history.

## Protocol additions

Do not tunnel artifacts through assistant markdown. Add explicit frames and advertise an
`artifacts_v1` capability:

- `artifact_list` / `artifact_list_result`
- `artifact_get { id, version? }`
- `artifact_manifest`
- `artifact_chunk` / `artifact_done`
- `artifact_ready { id, version, title, digest }`
- `artifact_action { id, version, actionId, input, stateVersion }`
- `artifact_action_result`
- `artifact_error`

Large transfers should be resumable and bounded. Terminal results should use the same connector-
owned durability principle as background chat replies, so iOS suspension cannot lose a published
artifact version.

## Agent authoring contract

Each native Summit plugin should expose the same small artifact toolkit to the agent:

- `summit_artifact_create`
- `summit_artifact_validate`
- `summit_artifact_preview`
- `summit_artifact_publish`
- `summit_artifact_list_versions`
- `summit_artifact_rollback`

The toolkit should include examples, a JSON Schema/type package, a validator, a screenshot/preview
harness, and mobile layout rules. The agent writes files locally, validates them, and only then emits
`artifact_ready`.

Framework-specific code stays in the plugin. The manifest, protocol, app runtime, and user
experience remain shared across Hermes and OpenClaw.

## Generation lifecycle

The language model should not generate a finished bundle inside a chat message. It authors source
through a deterministic toolkit running on the user's agent host:

```text
User request
    ↓
Agent creates or patches local source
    ↓
Artifact toolkit: compile → validate → preview/test
    ↓                         ↑ repair loop
Immutable published version + digest
    ↓
Connector/relay transports it; Summit verifies, caches and renders it
```

1. The user asks for an artifact in chat or chooses **Create artifact**.
2. `summit_artifact_create` scaffolds a manifest, typed source, stable component IDs and state
   schema in `~/.summit/artifacts/<id>/`. The scaffold—not the model—chooses the file layout and
   defaults.
3. The agent writes or patches those files. Normal chat context carries only the artifact ID,
   manifest summary and relevant file map; the agent reads source on demand instead of pasting the
   whole artifact into every turn.
4. A deterministic compiler emits canonical Canvas JSON. The validator rejects unknown
   components, undeclared actions, invalid state access, inaccessible layouts, secret-shaped
   values, excessive size and incompatible runtime requirements.
5. The preview harness renders a phone-sized snapshot and runs interaction checks. Validation
   errors go back to the agent for a bounded repair loop.
6. `summit_artifact_publish` atomically writes an immutable version, calculates its digest and
   advances a small `current.json` pointer only after validation succeeds.
7. The connector emits durable `artifact_ready`; the app fetches the package, verifies the digest,
   records its metadata and renders it. The last published version remains live throughout the
   build, so a bad draft cannot break the user's working tool.

This creates a clean responsibility boundary:

| Owner | Responsibility |
|---|---|
| Agent | Understand intent; write and revise source; explain meaningful behavior changes |
| Artifact toolkit/plugin | Scaffold, compile, validate, preview, version, store and migrate |
| Summit app | Safely render, cache, capture errors and enforce action confirmations |
| Connector/relay | Authenticated transport and durable delivery only |

Do not add a separate artifact cloud or build service. Generation happens where the agent already
runs, which preserves local ownership and gives the agent access to its existing tools and files.

## Upkeep and recovery

Artifacts need product-managed maintenance, but they must not silently rewrite themselves.

- **User-directed update:** **Edit with agent** opens a draft from the current version. The agent
  makes a targeted patch, previews it, and the user accepts or rejects the new version.
- **Runtime repair:** Summit reports a redacted error envelope containing artifact ID, version,
  component/action ID and error code. **Repair with agent** starts a patch from the last-known-good
  version. Repeated failures trip a circuit breaker instead of repeatedly crashing the viewer.
- **Compatibility update:** manifests declare `schemaVersion`, `runtimeVersion` and `stateVersion`.
  Summit continues rendering older supported runtime versions. A deterministic migrator handles
  mechanical upgrades; semantic changes become a proposed agent edit with a preview.
- **State safety:** code and state are versioned separately. Publishing UI code never erases user
  data. A state-schema change requires an explicit migration, a pre-migration snapshot and a
  rollback path.
- **Atomic releases:** drafts never replace the published package. A version becomes current only
  after compilation, validation and digest verification; the app retains the last-known-good
  package for offline use and rollback.
- **Dependency control:** Canvas artifacts cannot install arbitrary npm packages. They use the
  fixed, versioned component/formula runtime shipped with Summit, preventing abandoned dependency
  trees from becoming the user's maintenance problem.
- **Health checks:** after a Summit runtime or plugin upgrade, the toolkit can validate all local
  artifacts and label incompatible ones **Needs update**. It may prepare a repair draft, but it does
  not publish behavior-changing edits without the user.
- **Archival:** deleting from the drawer archives the artifact first. Permanent deletion explicitly
  removes host source/state and the phone cache; ordinary rollback never destroys newer versions.

The practical promise is: the agent performs the upkeep, the deterministic toolkit proves the
result is structurally safe, and the user remains the publisher of any meaningful change.

## Editing: the feature that makes this more than a renderer

The Artifact viewer's main action is **Edit with agent**. It opens a compact composer already scoped
to the artifact ID and version. Summit provides the agent with:

- the current manifest and source location;
- current version and state schema;
- runtime error, if one occurred;
- optional screenshot and selected component ID;
- the user's requested change.

Creative extension: **point-and-change**. In edit mode the user taps a component, Summit highlights
it, and the prompt begins with that stable component ID. “Make this chart show seven days” becomes a
precise patch rather than a full rewrite.

Every successful edit creates a previewable version. The user can compare, accept, or roll back.

## V2 delivery ladder

### A0 — Feasibility spikes

- Generate one Canvas artifact from Hermes and render it on a physical iPhone.
- Prove versioned transport and cache recovery across app suspension.
- Run an App Review policy consultation/test submission for the Canvas interpretation.
- Separately prototype a locked-down WebView and decide whether Artifact Lab is viable.

**Gate:** no V2 build commitment until the fixed native Canvas path and policy position are clear.

### A1 — Useful static artifacts

- Canvas renderer, schema validator and mobile layout system.
- Documents, charts, tables, forms, formulas and local interaction.
- `artifact_ready` chat card, full-screen viewer and agent-scoped drawer library.
- Immutable versions, source view, cache and rollback.
- Read-only offline use.

### A2 — Agent-backed artifacts

- Declared actions, per-action permission copy and approval routing.
- Agent-owned bounded state and optimistic concurrency.
- Background action completion through Summit's existing durable turn model.
- Edit with agent, runtime-error repair and point-and-change.

### A3 — Artifact Lab, only if cleared

- Self-contained web bundles and sandbox controls.
- No arbitrary networking, package downloads, native APIs, secrets or background execution.
- Security review, adversarial bundle corpus and App Store validation.

### Later, not V2 core

- public publishing, remixing, community gallery or marketplace;
- multi-human collaboration;
- third-party API credentials inside artifacts;
- payments or digital goods inside artifacts;
- arbitrary npm dependencies and native extensions;
- artifacts that keep running on the phone in the background.

## Feasibility by artifact type

| Artifact | Feasibility | Recommended runtime |
|---|---:|---|
| Document, diagram, dashboard, chart | High | Canvas |
| Form, calculator, tracker, checklist | High | Canvas |
| Agent-backed operational cockpit | Medium-high | Canvas + declared actions |
| Stateful private tool | Medium | Agent-owned state |
| Arbitrary React/HTML mini-app | Medium technically, high policy risk | Lab after gate |
| Public marketplace or multi-user SaaS | Low fit for V2 | Do not build |

## Success measures

- Artifact creation succeeds without the user touching source or build tools.
- A useful first artifact opens within one agent conversation.
- Most revisions are incremental rather than full rewrites.
- Runtime validation failures are repaired by the agent, not surfaced as raw stack traces.
- Agent-backed actions preserve Summit's existing approval and background-continuity guarantees.
- Users reopen artifacts across sessions, proving they are tools rather than novelty outputs.

## Principal risks

1. **App Store policy:** dynamic code can be treated as downloaded functionality. Canvas is the
   mitigation; Lab remains gated.
2. **Untrusted agent output:** all bundles and bridge messages require strict validation, limits and
   isolation.
3. **Scope explosion:** a browser IDE, npm cloud, hosting service and marketplace would become a
   different company. Summit should remain the cockpit.
4. **Mobile quality:** desktop-shaped generated interfaces will feel terrible. The SDK must encode
   mobile layout and accessibility constraints.
5. **Framework drift:** artifact transport belongs in the shared protocol, while authoring adapters
   stay explicit per framework.
6. **State/data leakage:** source packages must not embed secrets; action permissions are declared
   and state remains on the agent host.

## Product decision

Summit Artifacts belongs in V2 after the core agent flow is reliable in real-device beta. Begin with
Artifact Canvas and agent-backed actions. Treat arbitrary web code, publishing and remixing as
separate gated decisions—not assumptions hidden inside the first implementation.

## External references

- Anthropic, “What are artifacts and how do I use them?”
  https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
- Apple App Review Guidelines, especially 2.5.2 and 4.7
  https://developer.apple.com/app-store/review/guidelines/
- Apple `WKWebsiteDataStore.nonPersistent()`
  https://developer.apple.com/documentation/webkit/wkwebsitedatastore/nonpersistent()
- Apple `WKContentWorld`
  https://developer.apple.com/documentation/webkit/wkcontentworld
