/**
 * The agent mark: the connected harness's official logo on a tinted tile.
 *
 * The mark itself is not user-chosen — it identifies which harness the agent
 * runs on (Hermes, OpenClaw) at a glance, the same way a Slack integration
 * shows the source app's icon. The only user-chosen part is the tile's
 * accent tint. A framework without an official mark yet (the generic OpenAI
 * tier) falls back to a neutral `Bot` icon.
 *
 * Scope: profile hero, the profile's accent picker, and the sidebar switcher
 * row. This is the documented "agent mark" exception in `DESIGN_SYSTEM.md` —
 * it does not extend to the chat transcript, which stays avatar-free.
 */

import React from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Bot } from 'lucide-react-native';

import {
  accentAlpha,
  agentAccentPalette,
  colors,
  resolveAccent,
  withAlpha,
  type AgentAccent,
} from '@/theme';
import type { AgentFramework } from '@/agents/types';

/** Official harness logos, cropped to the mark itself (no wordmark, no chrome). */
const HARNESS_MARKS: Partial<Record<AgentFramework, ImageSourcePropType>> = {
  hermes: require('../../../assets/images/harness-hermes.png'),
  openclaw: require('../../../assets/images/harness-openclaw.png'),
};

type AgentAvatarProps = {
  framework?: string | null;
  accent?: string | null;
  /** Tile edge length in px. Radius and mark scale off this. */
  size: number;
  /** Draw only the mark, no tile — used inside the accent picker's preview. */
  bare?: boolean;
};

/**
 * Renders an agent's mark, degrading in two independent steps: an
 * unrecognized framework falls back to the neutral `Bot` icon, and an unknown
 * or absent accent falls back to greyscale. Either half can be set without
 * the other.
 */
export function AgentAvatar({ framework, accent, size, bare }: AgentAvatarProps) {
  const mark = framework ? HARNESS_MARKS[framework as AgentFramework] : undefined;
  const accentKey = resolveAccent(accent);
  const tint = accentKey ? agentAccentPalette[accentKey] : null;

  const glyphSize = Math.round(size * 0.58);
  const glyph = mark ? (
    <Image source={mark} style={{ width: glyphSize, height: glyphSize }} resizeMode="contain" />
  ) : (
    <Bot size={Math.round(size * 0.52)} color={tint ?? colors.ink} strokeWidth={1.5} />
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
