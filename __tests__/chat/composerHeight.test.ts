import {
  COMPOSER_MAX_HEIGHT,
  COMPOSER_MIN_HEIGHT,
  composerHeightFor,
} from '@/ui/chat/composerHeight';

describe('composerHeightFor', () => {
  it('rests at one line of body text before the draft wraps', () => {
    expect(COMPOSER_MIN_HEIGHT).toBe(28);
  });

  it('returns to its compact height when the message is cleared', () => {
    expect(composerHeightFor(COMPOSER_MAX_HEIGHT, false)).toBe(COMPOSER_MIN_HEIGHT);
  });

  it('grows with content and stops at its maximum height', () => {
    expect(composerHeightFor(48, true)).toBe(48);
    expect(composerHeightFor(500, true)).toBe(COMPOSER_MAX_HEIGHT);
  });
});
