/**
 * The agent identity mark: one of ten authored glyphs on a tinted tile.
 *
 * Drawn in code rather than shipped as raster art — the same mark has to stay
 * crisp at 28px in the sidebar row and 58px in the profile hero, and a code
 * glyph can take the agent's accent color directly instead of needing ten
 * pre-tinted copies of every image.
 *
 * The drawing language deliberately matches `lucide-react-native` (24-unit
 * viewBox, round caps and joins, one stroke weight) because these marks sit
 * inches from real lucide icons everywhere they appear; a second icon idiom
 * would read as an imported asset rather than part of the app.
 *
 * Scope: profile hero, the profile picker, and the sidebar switcher row. This
 * is the documented "agent identity mark" exception in `DESIGN_SYSTEM.md` —
 * it does not extend to the chat transcript, which stays avatar-free.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { Bot } from 'lucide-react-native';

import {
  accentAlpha,
  agentAccentPalette,
  colors,
  resolveAccent,
  withAlpha,
  type AgentAccent,
} from '@/theme';

/** Stroke weight in viewBox units — the whole set draws at one weight. */
const STROKE = 1.7;

/**
 * Glyph ids are persisted in SQLite, so these strings are a storage contract:
 * rename one and existing agents lose their mark. Add new ids to the end.
 */
export const AGENT_AVATAR_IDS = [
  'ridge',
  'orbit',
  'stack',
  'spark',
  'dusk',
  'hex',
  'prism',
  'pulse',
  'peak',
  'relay',
] as const;

export type AgentAvatarId = (typeof AGENT_AVATAR_IDS)[number];

/** Narrow an untrusted stored string to a known glyph id (unknown → null). */
export function resolveAvatarId(id: string | null | undefined): AgentAvatarId | null {
  return id && (AGENT_AVATAR_IDS as readonly string[]).includes(id)
    ? (id as AgentAvatarId)
    : null;
}

// ── The glyphs ──────────────────────────────────────────────────────────────
// Each renders inside a 24×24 viewBox and inherits `color` from its caller, so
// a glyph never names a color itself.

const GLYPHS: Record<AgentAvatarId, (color: string) => React.ReactNode> = {
  // A summit ridgeline — the house mark of the set.
  ridge: (c) => (
    <Path
      d="M2.5 17.5 L8.5 9 L12.5 14 L21.5 4.5"
      stroke={c}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),

  orbit: (c) => (
    <>
      <Circle cx={12} cy={12} r={3.4} stroke={c} strokeWidth={STROKE} fill="none" />
      <Ellipse
        cx={12}
        cy={12}
        rx={10}
        ry={4.6}
        stroke={c}
        strokeWidth={STROKE}
        fill="none"
        transform="rotate(-28 12 12)"
      />
    </>
  ),

  stack: (c) => (
    <Path
      d="M4.5 7.5 H19.5 M4.5 12 H19.5 M4.5 16.5 H13"
      stroke={c}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
    />
  ),

  spark: (c) => (
    <Path
      d="M12 2.5 C12.6 8.4 15.6 11.4 21.5 12 C15.6 12.6 12.6 15.6 12 21.5 C11.4 15.6 8.4 12.6 2.5 12 C8.4 11.4 11.4 8.4 12 2.5 Z"
      stroke={c}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill="none"
    />
  ),

  // A terminator line rather than a filled half, so it holds its weight at 28px.
  dusk: (c) => (
    <>
      <Circle cx={12} cy={12} r={8.6} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M12 3.4 A8.6 8.6 0 0 1 12 20.6 Z" fill={c} />
    </>
  ),

  hex: (c) => (
    <Path
      d="M12 2.6 L20.1 7.3 V16.7 L12 21.4 L3.9 16.7 V7.3 Z"
      stroke={c}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill="none"
    />
  ),

  prism: (c) => (
    <>
      <Path
        d="M12 2.4 L21.6 12 L12 21.6 L2.4 12 Z"
        stroke={c}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M12 8 L16 12 L12 16 L8 12 Z" fill={c} />
    </>
  ),

  pulse: (c) => (
    <Path
      d="M2 12 H6 L8.5 5.5 L12.5 18.5 L15.5 10 L17.5 12 H22"
      stroke={c}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),

  peak: (c) => (
    <Path
      d="M12 3.4 L21 19.4 H3 Z"
      stroke={c}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill="none"
    />
  ),

  // A hub with three spokes — the relay topology the app actually runs on.
  relay: (c) => (
    <>
      <Path
        d="M12 12 L12 4.6 M12 12 L18.4 15.7 M12 12 L5.6 15.7"
        stroke={c}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={12} cy={12} r={2.6} fill={c} />
      <Circle cx={12} cy={3.6} r={1.9} stroke={c} strokeWidth={STROKE} fill="none" />
      <Circle cx={19.4} cy={16.4} r={1.9} stroke={c} strokeWidth={STROKE} fill="none" />
      <Circle cx={4.6} cy={16.4} r={1.9} stroke={c} strokeWidth={STROKE} fill="none" />
    </>
  ),
};

// ── The mark ────────────────────────────────────────────────────────────────

type AgentAvatarProps = {
  avatarId?: string | null;
  accent?: string | null;
  /** Tile edge length in px. Radius and glyph scale off this. */
  size: number;
  /** Draw only the glyph, no tile — used inside the picker's own cells. */
  bare?: boolean;
};

/**
 * Renders an agent's mark, degrading in two independent steps: an unknown or
 * absent glyph id falls back to the neutral `Bot` icon this screen used before
 * identity marks existed, and an unknown or absent accent falls back to
 * greyscale. Either half can be set without the other.
 */
export function AgentAvatar({ avatarId, accent, size, bare }: AgentAvatarProps) {
  const glyphId = resolveAvatarId(avatarId);
  const accentKey = resolveAccent(accent);
  const tint = accentKey ? agentAccentPalette[accentKey] : null;

  const glyphColor = tint ?? colors.ink;
  const glyphSize = Math.round(size * 0.52);

  const glyph = glyphId ? (
    <Svg width={glyphSize} height={glyphSize} viewBox="0 0 24 24">
      {GLYPHS[glyphId](glyphColor)}
    </Svg>
  ) : (
    <Bot size={glyphSize} color={glyphColor} strokeWidth={1.5} />
  );

  if (bare) return <>{glyph}</>;

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          // Radius tracks the tile so a 28px chip and a 58px hero read as the
          // same shape rather than two different roundings.
          borderRadius: Math.round(size * 0.32),
          backgroundColor: tint ? withAlpha(tint, accentAlpha.fill) : colors.surface,
          borderColor: tint ? withAlpha(tint, accentAlpha.line) : colors.line,
        },
      ]}
    >
      {glyph}
    </View>
  );
}

/** Resolved hex for an accent key, for callers that need the raw value. */
export function accentHex(accent: string | null | undefined): string | null {
  const key = resolveAccent(accent);
  return key ? agentAccentPalette[key] : null;
}

export type { AgentAccent };

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
