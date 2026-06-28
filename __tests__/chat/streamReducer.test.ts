import { initialTurn, reduceTurn, turnToBlocks } from '@/ui/chat/streamReducer';

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
  });

  it('marks the turn done on done', () => {
    const t = reduceTurn(initialTurn, { type: 'done' });
    expect(t).toMatchObject({ status: 'idle', done: true });
  });

  it('captures the error message and finishes on error', () => {
    const t = reduceTurn(initialTurn, { type: 'error', message: 'dropped' });
    expect(t).toMatchObject({ status: 'error', error: 'dropped', done: true });
  });
});

describe('turnToBlocks', () => {
  it('wraps accumulated text in a single markdown block', () => {
    const t = reduceTurn(initialTurn, { type: 'delta', text: '# Hi' });
    expect(turnToBlocks(t)).toEqual([{ kind: 'markdown', source: '# Hi' }]);
  });
});
