# Cron Job Composition Ladder — Design

**Date:** 2026-07-01
**Status:** Approved (brainstorm), pending implementation plan

## Purpose

On the cron job detail page, show a static **Structure** ladder that visualises what a
job is *made of* — its trigger, the context it pulls, the task it performs, the skills it
may use, and where it delivers. This is drawn entirely from the job's stored definition,
which we already fetch via `GET /api/jobs`. No run is triggered, nothing streams, and no
backend (Hermes / connector / relay) changes.

## Key constraint (why this is "composition", not "execution")

A cron job's stored record is **not an ordered sequence of steps**. It is a schedule, a
task (a `prompt`, or a `script` for `no_agent` jobs), a *set* of skills it is allowed to
use, and a delivery target. The actual "then skill A, then skill B" order only exists at
runtime, when the agent decides it — and Hermes does not persist that trace. So this
feature renders the job's **parts**, top to bottom, not a guaranteed execution order. The
live execution trace is explicitly out of scope (see below).

## Data model

Extend the parsed job with the definition fields we don't yet capture.

`CronJob` (`src/ui/cron/types.ts`) gains:

| Field | Type | Source (raw record) |
|---|---|---|
| `prompt` | `string \| null` | `prompt` (empty string for script jobs) |
| `script` | `string \| null` | `script` |
| `noAgent` | `boolean` | `no_agent` |
| `contextFrom` | `string \| null` | `context_from` |

`normalizeJob` (`src/agents/adapters/jobs.ts`) reads these alongside the schedule / skills
/ deliver it already parses, defensively (missing → `null` / `false`). Existing fields
(`skills`, `schedule`, `deliver`, `origin`) are unchanged.

**No new fetch:** these fields are already present in the `GET /api/jobs` list payload, so
`listJobs()` (which works today over the relay) carries everything the ladder needs.

## Derivation — one pure function

`jobLadder(job: CronJob): LadderNode[]` in `src/ui/cron/types.ts`, sitting with the other
pure derivations (`formatDeliver`, `displayStatus`, …).

```ts
type LadderNodeKind = 'trigger' | 'context' | 'task' | 'deliver';
type LadderNode = {
  kind: LadderNodeKind;
  title: string;        // "Trigger" · "Context" · "Task" · "Deliver"
  detail: string;       // schedule text / context source / prompt-or-script / target
  skills?: string[];    // only on the task node
};
```

Ordered output:

1. **trigger** — `detail = job.schedule.display`
2. **context** — only when `job.contextFrom` is set — `detail = job.contextFrom`
3. **task** —
   - script job (`job.script` present): `detail = "Run script <script>"`
   - agent job with a prompt: `detail = job.prompt`
   - neither: `detail = "Runs the agent"`
   - `skills = job.skills` when non-empty (chips)
4. **deliver** — `detail = formatDeliver(job.deliver, job.origin)`

Pure, no I/O — directly unit-testable.

## UI

**New component** `src/ui/cron/JobLadder.tsx` renders `LadderNode[]` as a static vertical
rail: a connecting line, a node dot per row, a small uppercase `title`, the `detail`, and
skill chips on the task node. It reuses `ProcessTrace`'s visual language (rail + node) but
is calm — no pulse/animation — and reads all colours/spacing from `src/theme.ts`.

It is a **separate component** from `ProcessTrace` on purpose: they look alike but mean
different things (static structure vs live execution), so each stays single-purpose.

**Integration in `CronDetail`:** add an always-visible **Structure** section rendering
`<JobLadder nodes={jobLadder(job)} />`. The current standalone Skills card is removed — its
skills now live in the ladder's task node. The existing live-trace and result sections are
untouched.

## Empty / thin handling

- Script-only job, no skills → `trigger → task(Run script) → deliver` (3 nodes).
- No prompt and no script → task node reads "Runs the agent".
- No `context_from` → context node omitted.
- No error states are needed; the ladder always renders from present data.

## Testing

- **`jobLadder()` unit tests:** thin script job (Telegram-Idea-Inbox shape) → `[trigger,
  task(Run script), deliver]`; rich agent job with prompt + skills + context → `[trigger,
  context, task(+skills), deliver]`; missing prompt+script → task detail "Runs the agent".
- **Normalizer test:** extend the existing `jobs` normalizer test to assert `prompt`,
  `script`, `noAgent`, `contextFrom` are parsed (present and absent).

No relay / connector / streaming, so there is no integration surface to test.

## Out of scope (explicitly deferred)

- Live execution trace (watching a run step-by-step) and the "Run to watch" flow.
- Connector-side recording of runs the app didn't witness.
- Historical run list / past-run traces.

## Files touched

- `src/ui/cron/types.ts` — `CronJob` fields, `LadderNode`, `jobLadder()`
- `src/agents/adapters/jobs.ts` — parse the four new fields
- `src/ui/cron/JobLadder.tsx` — new static ladder component
- `src/ui/cron/CronDetail.tsx` — add Structure section, remove standalone Skills card
- `__tests__/` — `jobLadder` tests + normalizer field tests
