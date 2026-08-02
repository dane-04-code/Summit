import { pendingPush } from '@/ui/chat/pushRoute';

it('has nothing pending without a session id', () => {
  expect(pendingPush({}, null)).toBeNull();
  expect(pendingPush({ n: '17' }, null)).toBeNull();
});

it('reports a tap that has not been honoured yet', () => {
  expect(pendingPush({ sessionId: 's1', n: '17' }, null)).toEqual({
    sessionId: 's1',
    tap: '17:s1',
  });
});

it('ignores the param once its tap has been consumed', () => {
  const pending = pendingPush({ sessionId: 's1', n: '17' }, null)!;
  // What a re-render, or a manual agent switch, sees afterwards.
  expect(pendingPush({ sessionId: 's1', n: '17' }, pending.tap)).toBeNull();
});

it('honours a second push for the same session as a new tap', () => {
  const first = pendingPush({ sessionId: 's1', n: '17' }, null)!;
  expect(pendingPush({ sessionId: 's1', n: '42' }, first.tap)).toEqual({
    sessionId: 's1',
    tap: '42:s1',
  });
});

it('honours a different session even under the same tap marker', () => {
  const first = pendingPush({ sessionId: 's1', n: '17' }, null)!;
  expect(pendingPush({ sessionId: 's2', n: '17' }, first.tap)?.sessionId).toBe('s2');
});

it('tolerates a missing nonce and array-valued params', () => {
  expect(pendingPush({ sessionId: 's1' }, null)).toEqual({ sessionId: 's1', tap: ':s1' });
  expect(pendingPush({ sessionId: ['s1'], n: ['17'] }, null)).toEqual({
    sessionId: 's1',
    tap: '17:s1',
  });
});
