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
  bg: '#FFFFFF',
  ink: '#111114',
  muted: '#8A8A8E',
  bubble: '#F2F2F7',
  codeBg: '#F6F6F6',
  line: '#E5E5E7',
  accent: '#0A7AFF',
  error: '#E5484D',
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
  input: 12,
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

export const screenPadding = 16;
