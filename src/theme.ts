/**
 * Design-system tokens for Agent Messenger.
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
  accent: '#5B9DFF',
  onAccentBtn: '#0F1012',
  error: '#FF6B6B',
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
