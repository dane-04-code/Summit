import {
  initialTurn,
  reduceTurn,
  settleErrorBlocks,
  turnToBlocks,
} from '@/ui/chat/streamReducer';

describe('reduceTurn', () => {
  it('accumulates delta text and stays running', () => {
    let t = initialTurn;
    t = reduceTurn(t, { type: 'delta', text: 'Hel' });
    t = reduceTurn(t, { type: 'delta', text: 'lo' });
    expect(t.text).toBe('Hello');
    expect(t.status).toBe('running');
    expect(t.done).toBe(false);
  });

  it('records the latest tool label', () => {
    const t = reduceTurn(initialTurn, { type: 'tool', label: 'searching the web…' });
    expect(t.toolLabel).toBe('searching the web…');
    expect(turnToBlocks(t)).toEqual([
      { kind: 'activity', label: 'searching the web…' },
    ]);
  });

  it('clears operational activity when answer text resumes', () => {
    const active = reduceTurn(initialTurn, { type: 'tool', label: 'Reading files…' });
    const resumed = reduceTurn(active, { type: 'delta', text: 'Found it.' });
    expect(resumed.toolLabel).toBe('Reading files…');
    expect(turnToBlocks(resumed)).toEqual([
      { kind: 'markdown', source: 'Found it.' },
      { kind: 'activity', label: 'Reading files…' },
    ]);
  });

  it('keeps only the current safe tool label', () => {
    let turn = reduceTurn(initialTurn, { type: 'tool', label: 'Reading files…' });
    turn = reduceTurn(turn, { type: 'tool', label: 'Reading files…' });
    turn = reduceTurn(turn, { type: 'tool', label: 'Running tests…' });

    expect(turnToBlocks(turn)).toEqual([
      {
        kind: 'activity',
        label: 'Running tests…',
      },
    ]);
  });

  it('marks the turn done on done', () => {
    const t = reduceTurn(initialTurn, { type: 'done' });
    expect(t).toMatchObject({ status: 'idle', done: true });
  });

  it('replaces a revised streamed draft with authoritative terminal text', () => {
    const partial = reduceTurn(initialTurn, { type: 'delta', text: 'Earlier draft.' });
    const settled = reduceTurn(partial, { type: 'done', content: 'Final answer.' });
    expect(settled).toMatchObject({ text: 'Final answer.', status: 'idle', done: true });
  });

  it('captures the error message and finishes on error', () => {
    const t = reduceTurn(initialTurn, { type: 'error', message: 'dropped' });
    expect(t).toMatchObject({ status: 'error', error: 'dropped', done: true });
  });

  it('starts with no pending approval', () => {
    expect(initialTurn.pendingApproval).toBeNull();
  });

  it('captures a pending approval and keeps the turn open', () => {
    const t = reduceTurn(initialTurn, {
      type: 'approval',
      runId: 'run_42',
      title: 'Run a shell command?',
      command: './deploy.sh',
    });
    expect(t.pendingApproval).toEqual({
      runId: 'run_42',
      title: 'Run a shell command?',
      command: './deploy.sh',
    });
    // An approval gate is not the end of the turn — the run resumes after the
    // user decides, so `done` must stay false.
    expect(t.done).toBe(false);
  });
});

describe('turnToBlocks', () => {
  it('wraps accumulated text in a single markdown block', () => {
    const t = reduceTurn(initialTurn, { type: 'delta', text: '# Hi' });
    expect(turnToBlocks(t)).toEqual([{ kind: 'markdown', source: '# Hi' }]);
  });

  it('labels the failure reason explicitly', () => {
    expect(settleErrorBlocks('', 'Gateway restarted')).toEqual([
      {
        kind: 'text',
        spans: [{ text: 'Failed: Gateway restarted' }],
        tone: 'error',
      },
    ]);
  });
});
