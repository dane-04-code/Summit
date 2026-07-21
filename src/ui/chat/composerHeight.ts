export const COMPOSER_MIN_HEIGHT = 24;
export const COMPOSER_MAX_HEIGHT = 120;

export function composerHeightFor(contentHeight: number, hasText: boolean): number {
  if (!hasText) return COMPOSER_MIN_HEIGHT;
  return Math.min(
    COMPOSER_MAX_HEIGHT,
    Math.max(COMPOSER_MIN_HEIGHT, contentHeight),
  );
}
