/** One compact text line, aligned with the 38px composer controls. */
export const COMPOSER_MIN_HEIGHT = 38;
export const COMPOSER_MAX_HEIGHT = 120;

export function composerHeightFor(contentHeight: number, hasText: boolean): number {
  if (!hasText) return COMPOSER_MIN_HEIGHT;
  return Math.min(
    COMPOSER_MAX_HEIGHT,
    Math.max(COMPOSER_MIN_HEIGHT, contentHeight),
  );
}
