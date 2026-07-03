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
