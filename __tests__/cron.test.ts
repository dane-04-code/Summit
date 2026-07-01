import { colors } from '../src/theme';
import {
  displayStatus,
  formatDeliver,
  formatNext,
  formatRelative,
  jobLadder,
  stepStyle,
  type CronJob,
} from '../src/ui/cron/types';
import { readJobRunResponse, readJobsResponse } from '../src/agents/adapters/jobs';

const baseJob: CronJob = {
  id: 'x',
  name: 'X',
  schedule: { kind: 'cron', expr: '0 7 * * *', display: '0 7 * * *' },
  state: 'scheduled',
  enabled: true,
  last_status: 'ok',
  last_run_at: null,
  next_run_at: null,
  deliver: 'local',
  origin: null,
  skills: [],
  prompt: null,
  script: null,
  noAgent: false,
  contextFrom: null,
};

describe('displayStatus', () => {
  it('prefers live state over last outcome', () => {
    expect(displayStatus({ ...baseJob, state: 'running' })).toBe('running');
    expect(displayStatus({ ...baseJob, state: 'paused' })).toBe('paused');
  });

  it('falls back to last_status, then never', () => {
    expect(displayStatus({ ...baseJob, last_status: 'ok' })).toBe('ok');
    expect(displayStatus({ ...baseJob, last_status: 'error' })).toBe('error');
    expect(displayStatus({ ...baseJob, last_status: null })).toBe('never');
  });
});

describe('formatters', () => {
  it('formats relative last-run times', () => {
    expect(formatRelative(null)).toBe('Never');
    expect(formatRelative(new Date(Date.now() - 2 * 3600_000).toISOString())).toBe('2h ago');
    expect(formatRelative(new Date(Date.now() - 6 * 60_000).toISOString())).toBe('6m ago');
  });

  it('formats next-run times', () => {
    expect(formatNext(null)).toBe('—');
    expect(formatNext(new Date(Date.now() + 9 * 60_000).toISOString())).toBe('in 9 min');
  });

  it('formats delivery targets from deliver + origin', () => {
    expect(formatDeliver('local', null)).toBe('Local');
    expect(
      formatDeliver('telegram:123', { platform: 'telegram', chat_name: 'Muddle Puddle' }),
    ).toBe('Telegram · Muddle Puddle');
    expect(formatDeliver('telegram:123', null)).toBe('Telegram');
  });
});

describe('step styling', () => {
  it('only the running node pulses; only the done node shows a check', () => {
    expect(stepStyle('run').pulse).toBe(true);
    expect(stepStyle('done').pulse).toBe(false);
    expect(stepStyle('done').showCheck).toBe(true);
    expect(stepStyle('err').showCheck).toBe(false);
    expect(stepStyle('err').cardBg).toBe(colors.errorSurface);
  });
});

describe('jobLadder', () => {
  it('builds trigger → task(run script) → deliver for a thin script job', () => {
    const nodes = jobLadder({
      ...baseJob,
      schedule: { kind: 'interval', expr: 'every 5m', display: 'every 5m' },
      script: 'telegram-idea-inbox.py',
      noAgent: true,
      deliver: 'telegram:123',
      origin: { platform: 'telegram', chat_name: 'Ideas' },
    });
    expect(nodes.map((n) => n.kind)).toEqual(['trigger', 'task', 'deliver']);
    expect(nodes[0].detail).toBe('every 5m');
    expect(nodes[1]).toMatchObject({ title: 'Run script', detail: 'telegram-idea-inbox.py' });
    expect(nodes[1].skills).toBeUndefined();
    expect(nodes[2].detail).toBe('Telegram · Ideas');
  });

  it('includes context and skills for a rich agent job', () => {
    const nodes = jobLadder({
      ...baseJob,
      prompt: 'Summarise overnight email and flag urgent',
      skills: ['gmail', 'calendar'],
      contextFrom: 'last 24h email',
    });
    expect(nodes.map((n) => n.kind)).toEqual(['trigger', 'context', 'task', 'deliver']);
    expect(nodes[1].detail).toBe('last 24h email');
    expect(nodes[2]).toMatchObject({
      title: 'Task',
      detail: 'Summarise overnight email and flag urgent',
    });
    expect(nodes[2].skills).toEqual(['gmail', 'calendar']);
  });

  it('falls back to "Runs the agent" with no prompt or script', () => {
    const task = jobLadder(baseJob).find((n) => n.kind === 'task');
    expect(task?.detail).toBe('Runs the agent');
  });
});

describe('Hermes jobs response mapping', () => {
  it('reads a list response into CronJob records', () => {
    const jobs = readJobsResponse({
      jobs: [
        {
          id: 'daily',
          name: 'Daily brief',
          schedule: { kind: 'cron', expr: '0 7 * * *' },
          enabled: true,
          last_status: 'completed',
          last_run_at: '2026-06-29T06:00:00.000Z',
          next_run_at: '2026-06-30T06:00:00.000Z',
          deliver: 'telegram:123',
          origin: { platform: 'telegram', chat_name: 'Ops' },
          skills: ['briefing'],
          prompt: 'Summarise overnight',
          context_from: 'inbox',
        },
      ],
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: 'daily',
      name: 'Daily brief',
      state: 'scheduled',
      last_status: 'ok',
      deliver: 'telegram:123',
      skills: ['briefing'],
      prompt: 'Summarise overnight',
      contextFrom: 'inbox',
      script: null,
      noAgent: false,
    });
  });

  it('maps disabled jobs to paused and latest run output to CronRun', () => {
    const [job] = readJobsResponse([
      {
        id: 'x',
        name: 'X',
        cron: '0 2 * * *',
        enabled: false,
        last_status: 'failed',
        script: 'x.py',
        no_agent: true,
      },
    ]);
    expect(job.state).toBe('paused');
    expect(job.next_run_at).toBeNull();
    expect(job.script).toBe('x.py');
    expect(job.noAgent).toBe(true);

    expect(
      readJobRunResponse({
        latest_run: {
          started_at: '2026-06-29T10:00:00.000Z',
          status: 'failed',
          output: 'Migration failed',
        },
      }),
    ).toMatchObject({ status: 'error', result: 'Migration failed' });
  });
});
