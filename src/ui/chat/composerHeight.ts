import { typography } from '@/theme';

/** The draft is set in body type, so a line of it is one body line box. */
const LINE = typography.body.lineHeight;

/**
 * One text line, with a little slack. The field owns its own row in the tray,
 * so the resting height is a line box (17/24) rather than the control height —
 * the slack absorbs the platform's own rounding on a one-line measurement so
 * the tray does not twitch on the first keystroke.
 */
export const COMPOSER_MIN_HEIGHT = LINE + 4;
/** Five lines. Past that the draft scrolls instead of eating the thread. */
export const COMPOSER_MAX_HEIGHT = LINE * 5;

export function composerHeightFor(contentHeight: number, hasText: boolean): number {
  if (!hasText) return COMPOSER_MIN_HEIGHT;
  return Math.min(
    COMPOSER_MAX_HEIGHT,
    // Round up: a fractional measurement that lands just under a line box
    // would otherwise clip the last line's descenders.
    Math.max(COMPOSER_MIN_HEIGHT, Math.ceil(contentHeight)),
  );
}
