/**
 * One text line, with a little slack. The field owns its own row in the tray,
 * so the resting height is a line box (17/24) rather than the control height —
 * the slack absorbs the platform's own rounding on a one-line measurement so
 * the tray does not twitch on the first keystroke.
 */
export const COMPOSER_MIN_HEIGHT = 28;
/** Five lines. Past that the draft scrolls instead of eating the thread. */
export const COMPOSER_MAX_HEIGHT = 120;

export function composerHeightFor(contentHeight: number, hasText: boolean): number {
  if (!hasText) return COMPOSER_MIN_HEIGHT;
  return Math.min(
    COMPOSER_MAX_HEIGHT,
    Math.max(COMPOSER_MIN_HEIGHT, contentHeight),
  );
}
