/**
 * Design-system tokens for Summit.
 * Single source of truth — import from here, never use raw hex / magic numbers.
 *
 * Note: the type-scale export is named `typography` instead of `type` to avoid
 * colliding with the TypeScript `type` keyword in import positions.
 */

import { TextStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

export const colors = {
  bg: '#0F1012',
  surface: '#1A1B1E',
  surface2: '#232428',
  drawer: '#161719', // navigation drawer panel — sits between bg and surface
  hover: '#1F2023', // pressed/active row in lists (sidebar recents)
  ink: '#F4F4F5',
  muted: '#8B8B92',
  bubble: '#1A1B1E',
  codeBg: '#1A1B1E',
  line: '#2A2B2F',
  lineFocus: '#3E3F45', // input border when focused — a gentle lift, still grey
  raised: '#1C1D20', // a card lifted just above `surface` (e.g. the cron "drop" artifact)
  accent: '#5B9DFF',
  accentLine: '#2F3A4A', // accent-tinted hairline (credential / auth steps)
  onAccentBtn: '#0F1012',
  ink2: '#C9C9CE', // secondary ink — quieter than `ink` (mono call text, completed nodes)
  faint: '#5B5B62', // dimmest legible grey — cron pills, durations, glyphs, separators
  error: '#FF6B6B',
  success: '#7BD88F', // confirmation moments ("Copied", paired) — same green family as mdString
  scrim: '#000000', // overlay scrim behind the drawer / modals (applied at partial opacity)
  errorSurface: '#1B1617', // error-tinted card fill (a failed run)
  errorLine: '#3A2526', // error-tinted card hairline
  fileGlyph: '#202127', // .md file-icon fill in the attachment card
  frontmatterBg: '#15161A', // YAML front-matter card fill in the doc reader
  mdString: '#7BD88F', // front-matter string values / code strings (green)
  mdDate: '#E0A37E', // front-matter date / number values / code numbers (amber)
  codeBlockBg: '#141519', // code-block body fill (a touch below `surface`)
  codeFunc: '#C9A6F0', // syntax: function / def names (violet)
  codeBuiltin: '#6FC8D6', // syntax: built-ins (cyan)
  highlightBg: '#2C3A55', // ==highlight== mark background (accent-tinted)
} as const;

/**
 * Agent identity accents — a fixed, named palette a user may assign to one
 * paired agent. This is the *only* sanctioned multi-color surface in the app
 * and it is scoped to the agent identity mark (profile hero + sidebar switcher
 * row); see the "agent identity mark" exception in `DESIGN_SYSTEM.md`.
 *
 * These are deliberately not `colors.*` — a component must never reach for one
 * as a general-purpose color. `colors.accent` stays the app's one true accent
 * and is not a pickable value here, so an agent mark can never impersonate a
 * link or a focus ring. `error`/`success` hues are likewise excluded: they
 * already carry meaning.
 *
 * Every value is tuned to clear 4.5:1 against `colors.bg` (#0F1012) and
 * `colors.drawer` (#161719) so a glyph drawn in it stays legible at 28px.
 */
export const agentAccentPalette = {
  coral:  '#FF8A65',
  amber:  '#E0A37E',
  gold:   '#D8CC63', // pushed off `amber` — they were the closest pair in the set
  lime:   '#9CCB6E',
  teal:   '#6FC8D6',
  azure:  '#7FB2FF', // a lifted cousin of `colors.accent`, never `accent` itself
  violet: '#C9A6F0',
  pink:   '#E890C4',
  slate:  '#9AA2B8',
  rose:   '#E67E8A',
} as const;

export type AgentAccent = keyof typeof agentAccentPalette;

export const agentAccentNames = Object.keys(agentAccentPalette) as AgentAccent[];

/**
 * Narrow an untrusted stored string to a palette key (unknown → null).
 *
 * Own-property check, not `in`: `'__proto__' in agentAccentPalette` is true via
 * the prototype chain, which would let a junk stored value resolve to a "key"
 * whose lookup yields an object rather than a color.
 */
export function resolveAccent(name: string | null | undefined): AgentAccent | null {
  return name && Object.prototype.hasOwnProperty.call(agentAccentPalette, name)
    ? (name as AgentAccent)
    : null;
}

/**
 * Opacity steps for the identity mark, so the tile reads as a tonal layer that
 * happens to be tinted rather than as a block of color. Kept here (not inline)
 * because the tile fill and its hairline must stay in lockstep across the two
 * surfaces that draw them.
 */
export const accentAlpha = {
  /** Tile fill — barely above `surface`, a wash not a fill. */
  fill: '1F',
  /** Tile hairline — reads as an edge, not a highlight. */
  line: '4D',
  /** Unselected swatch ring in the picker. */
  ghost: '33',
} as const;

/** Append an 8-bit hex alpha to a 6-digit hex color (RN accepts #RRGGBBAA). */
export function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

// ---------------------------------------------------------------------------
// Spacing scale: 4 · 8 · 12 · 16 · 24 · 32
// ---------------------------------------------------------------------------

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ---------------------------------------------------------------------------
// Border radii
// ---------------------------------------------------------------------------

export const radius = {
  bubble: 18,
  code: 10,
  input: 14,
  appMark: 16,
  control: 10, // small controls: icon/back buttons, small pills, list rows
} as const;

// ---------------------------------------------------------------------------
// Type scale
// (named `typography` — `type` collides with TS keyword in import contexts)
// ---------------------------------------------------------------------------

type TypographyToken = {
  fontSize: number;
  fontWeight: NonNullable<TextStyle['fontWeight']>;
  lineHeight: number;
};

export const typography: {
  title: TypographyToken;
  h: TypographyToken;
  body: TypographyToken;
  small: TypographyToken;
  mono: TypographyToken;
  caption: TypographyToken;
} = {
  title:   { fontSize: 28, fontWeight: '600', lineHeight: 34 },
  h:       { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  body:    { fontSize: 17, fontWeight: '400', lineHeight: 24 },
  small:   { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  mono:    { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 16 },
};

// ---------------------------------------------------------------------------
// Screen padding
// ---------------------------------------------------------------------------

export const screenPadding = 24;
