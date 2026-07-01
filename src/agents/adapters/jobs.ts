import type { CronJob, CronJobState, CronRun, LastStatus } from '@/ui/cron/types';

type RawRecord = Record<string, unknown>;

function obj(v: unknown): RawRecord | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as RawRecord) : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function lastStatus(v: unknown): LastStatus {
  const s = str(v)?.toLowerCase();
  if (!s) return null;
  if (['ok', 'success', 'succeeded', 'completed', 'complete'].includes(s)) return 'ok';
  if (['error', 'failed', 'failure'].includes(s)) return 'error';
  return null;
}

function state(raw: RawRecord): CronJobState {
  const s = str(raw.state ?? raw.status)?.toLowerCase();
  if (s === 'running') return 'running';
  if (s === 'paused' || bool(raw.enabled) === false) return 'paused';
  return 'scheduled';
}

function schedule(raw: RawRecord): CronJob['schedule'] {
  const source = obj(raw.schedule) ?? raw;
  const kind = str(source.kind)?.toLowerCase() === 'interval' ? 'interval' : 'cron';
  const expr =
    str(source.expr) ??
    str(source.expression) ??
    str(source.cron) ??
    str(source.interval) ??
    str(raw.cron) ??
    str(raw.interval) ??
    'unknown';
  return { kind, expr, display: str(source.display) ?? expr };
}

function origin(v: unknown): CronJob['origin'] {
  const raw = obj(v);
  if (!raw) return null;
  const platform = str(raw.platform);
  if (!platform) return null;
  return {
    platform,
    chat_id: str(raw.chat_id) ?? undefined,
    chat_name: str(raw.chat_name),
    thread_id: str(raw.thread_id),
  };
}

export function readJobsResponse(body: unknown): CronJob[] {
  const raw = obj(body);
  const rawJobs = Array.isArray(body) ? body : Array.isArray(raw?.jobs) ? raw.jobs : [];
  return rawJobs.map(normalizeJob).filter((j): j is CronJob => j !== null);
}

export function normalizeJob(v: unknown): CronJob | null {
  const raw = obj(v);
  if (!raw) return null;
  const id = str(raw.id ?? raw.job_id ?? raw.name);
  const name = str(raw.name ?? raw.title ?? raw.id);
  if (!id || !name) return null;

  const jobState = state(raw);
  return {
    id,
    name,
    schedule: schedule(raw),
    state: jobState,
    enabled: jobState !== 'paused',
    last_status: lastStatus(raw.last_status ?? raw.last_run_status ?? raw.status_last),
    last_run_at: str(raw.last_run_at ?? raw.lastRunAt),
    next_run_at: jobState === 'paused' ? null : str(raw.next_run_at ?? raw.nextRunAt),
    deliver: str(raw.deliver ?? raw.delivery ?? raw.target) ?? 'origin',
    origin: origin(raw.origin),
    skills: stringList(raw.skills),
    prompt: str(raw.prompt),
    script: str(raw.script),
    noAgent: bool(raw.no_agent) === true,
    contextFrom: str(raw.context_from),
  };
}

export function readJobRunResponse(body: unknown): CronRun | null {
  const raw = obj(body);
  if (!raw) return null;
  const run = obj(raw.latest_run) ?? obj(raw.last_run) ?? obj(raw.run) ?? raw;
  const at = str(run.at ?? run.started_at ?? run.created_at ?? raw.last_run_at);
  const status = lastStatus(run.status ?? raw.last_status);
  const result = str(run.result ?? run.output ?? run.summary ?? raw.last_result);
  if (!at && !result) return null;
  return {
    at: at ?? new Date().toISOString(),
    status,
    result: result ?? undefined,
  };
}
