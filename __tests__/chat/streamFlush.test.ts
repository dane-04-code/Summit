import { shouldFlush, STREAM_FLUSH_MS } from '@/ui/chat/streamReducer';

describe('shouldFlush', () => {
  it('always flushes terminal events regardless of elapsed time', () => {
    expect(shouldFlush(1000, 1001, true)).toBe(true);
  });

  it('suppresses flushes inside the window', () => {
    expect(shouldFlush(1000, 1000 + STREAM_FLUSH_MS - 1, false)).toBe(false);
  });

  it('flushes once the window has elapsed', () => {
    expect(shouldFlush(1000, 1000 + STREAM_FLUSH_MS, false)).toBe(true);
  });
});
