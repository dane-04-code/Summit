import { useFonts } from 'expo-font';

/**
 * Archivo Expanded Bold — the display face from the Summit website, pinned to
 * the exact axes the site uses (`wght 700`, `wdth 118`) as a static instance so
 * it renders identically on device without variable-font support.
 *
 * This is a deliberate, narrow exception to the system-font-only rule in
 * DESIGN.md: it is scoped to the pre-auth welcome screen's wordmark and
 * headline, which are brand surfaces rather than product UI. Everything past
 * sign-in stays on the system font.
 */
export const BRAND_DISPLAY_FONT = 'ArchivoExpanded-Bold';

/**
 * Loads the display face. Returns false until it is ready so callers can render
 * the system font in the meantime — the screen never blocks on the font, it
 * just swaps up to it. Resolves immediately once the font is embedded natively
 * via the `expo-font` config plugin.
 */
export function useBrandFont(): boolean {
  const [loaded] = useFonts({
    [BRAND_DISPLAY_FONT]: require('../../assets/fonts/ArchivoExpanded-Bold.ttf'),
  });
  return loaded;
}
