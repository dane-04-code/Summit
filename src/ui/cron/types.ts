/**
 * Content model for the Cron Drops viewer — shaped to the real Hermes Jobs API.
 *
 * `CronJob` mirrors a record from `GET /api/jobs` (the stored cron record). A
 * `CronRun` is one execution: its outcome/result is durable (Hermes writes each
 * run's output to disk), but the per-step `steps` trace is *live-only* — Hermes
 * streams it during an active run and does not persist it. So a job always has
 * metadata + last-run status; the step timeline is present only while running or
 * for a run the app witnessed and saved.
 *
 * ponytail: a `GET /api/jobs/{id}/runs` endpoint (proposed) would expose past
 * run outcomes + results from disk; per-step history still needs server work.
 */

import { colors } from '../../theme';

// ── Raw job record (subset we read from GET /api/jobs) ──────────────────────

export type CronSchedule = {
  kind: 'cron' | 'interval';
  expr: string; // "0 7 * * *" or "every 15m"
  display: string; // human-ish label Hermes provides
};

export type CronOrigin = {
  platform: string; // "telegram", …
  chat_id?: string;
  chat_name?: string | null;
  thread_id?: string | null;
};

/** Lifecycle state of the schedule itself. */
export type CronJobState = 'scheduled' | 'paused' | 'running';
/** Outcome of the most recent run (null = never run). */
export type LastStatus = 'ok' | 'error' | null;

export type CronJob = {
  id: string;
  name: string;
  schedule: CronSchedule;
  state: CronJobState;
  enabled: boolean;
  last_status: LastStatus;
  last_run_at: string | null; // ISO
  next_run_at: string | null; // ISO (null when paused)
  deliver: string; // "telegram:8441017376" | "local" | "origin"
  origin: CronOrigin | null;
  skills: string[];
  // ── Definition (drives the composition ladder) ────────────────────────────
  prompt: string | null; // the task prompt (null/empty for script jobs)
  script: string | null; // script filename for no_agent jobs
  noAgent: boolean; // true = runs a fixed script, not the agent
  contextFrom: string | null; // where the job pulls context from, if any
};

// ── One execution (live SSE now; GET /api/jobs/{id}/runs later) ─────────────

export type StepKind = 'done' | 'run' | 'err';

/** A node in the live process trace — derived from tool.started/completed. */
export type CronStep = {
  kind: StepKind;
  title: string;
  call?: string; // the tool invocation
  callTag?: string; // CRON · TOOL
  dur?: string; // "1.1s" · "1.8s…" while running
  error?: string; // only on `err`
};

export type CronRun = {
  at: string; // ISO — when the run fired
  status: LastStatus; // ok | error | null (still running)
  result?: string; // delivered output headline (durable, from the run's saved .md)
  steps?: CronStep[]; // live/witnessed trace; absent for past runs (not persisted)
};

// ── Derived display status (the badge) ──────────────────────────────────────

export type DisplayStatus = 'running' | 'paused' | 'ok' | 'error' | 'never';

/** Collapse `state` + `last_status` into the single badge a row/detail shows. */
export function displayStatus(job: CronJob): DisplayStatus {
  if (job.state === 'running') return 'running';
  if (job.state === 'paused') return 'paused';
  if (job.last_status === 'ok') return 'ok';
  if (job.last_status === 'error') return 'error';
  return 'never';
}

export const STATUS_META: Record<DisplayStatus, { color: string; label: string }> = {
  running: { color: colors.accent, label: 'Running now' },
  paused: { color: colors.faint, label: 'Paused' },
  ok: { color: colors.muted, label: 'Succeeded' },
  error: { color: colors.error, label: 'Failed' },
  never: { color: colors.faint, label: 'Never run' },
};

// ── Formatters (ISO timestamps + delivery target → display strings) ─────────

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "2h ago" · "12m ago" · "Never". */
export function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** "in 9 min" · "Today 7:00" · "Tomorrow 2:00" · "Mon 8:00" · "—" (paused). */
export function formatNext(iso: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diff = t - Date.now();
  if (diff <= 0) return 'due now';
  const min = Math.round(diff / 60000);
  if (min < 60) return `in ${min} min`;

  const date = new Date(t);
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(date, today)) return `Today ${time}`;
  if (sameDay(date, tomorrow)) return `Tomorrow ${time}`;
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]} ${time}`;
}

/** "Telegram · Muddle Puddle" · "Local" · platform name. */
export function formatDeliver(deliver: string, origin: CronOrigin | null): string {
  if (!deliver || deliver === 'local') return 'Local';
  if (deliver === 'origin') {
    if (origin?.chat_name) return origin.chat_name;
    return origin?.platform ? cap(origin.platform) : 'Origin';
  }
  const [platform] = deliver.split(':');
  const name =
    origin?.chat_name && (!origin.platform || origin.platform === platform)
      ? origin.chat_name
      : null;
  return name ? `${cap(platform)} · ${name}` : cap(platform);
}

// ── Composition ladder (static "what's inside this job") ────────────────────

export type LadderNodeKind = 'trigger' | 'context' | 'task' | 'deliver';

export type LadderNode = {
  kind: LadderNodeKind;
  title: string;
  detail: string;
  skills?: string[]; // only on the task node
};

/**
 * Break a job's stored definition into ordered ladder nodes — the parts it's
 * made of (trigger → context → task → deliver), NOT a runtime execution order
 * (that "skill A then B" chain is decided live and isn't persisted).
 */
export function jobLadder(job: CronJob): LadderNode[] {
  const nodes: LadderNode[] = [
    { kind: 'trigger', title: 'Trigger', detail: job.schedule.display },
  ];

  if (job.contextFrom) {
    nodes.push({ kind: 'context', title: 'Context', detail: job.contextFrom });
  }

  const task: LadderNode = job.script
    ? { kind: 'task', title: 'Run script', detail: job.script }
    : { kind: 'task', title: 'Task', detail: job.prompt ?? 'Runs the agent' };
  if (job.skills.length > 0) task.skills = job.skills;
  nodes.push(task);

  nodes.push({
    kind: 'deliver',
    title: 'Deliver',
    detail: formatDeliver(job.deliver, job.origin),
  });

  return nodes;
}

// ── Trace node styling ──────────────────────────────────────────────────────

export type StepStyle = {
  nodeBg: string;
  nodeBorder: string;
  nodeSize: number;
  cardBg: string;
  cardBorder: string;
  showCheck: boolean;
  pulse: boolean; // running node — animate a halo ring
};

export function stepStyle(kind: StepKind): StepStyle {
  const base: StepStyle = {
    nodeBg: colors.faint,
    nodeBorder: colors.faint,
    nodeSize: 18,
    cardBg: colors.drawer,
    cardBorder: colors.line,
    showCheck: false,
    pulse: false,
  };

  switch (kind) {
    case 'run':
      return { ...base, nodeBg: colors.accent, nodeBorder: colors.accent, cardBorder: colors.lineFocus, pulse: true };
    case 'err':
      return { ...base, nodeBg: colors.error, nodeBorder: colors.error, cardBg: colors.errorSurface, cardBorder: colors.errorLine };
    case 'done':
    default:
      return { ...base, nodeBg: colors.ink2, nodeBorder: colors.ink2, showCheck: true };
  }
}
