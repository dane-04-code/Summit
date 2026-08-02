/**
 * The agent identity picker — glyph grid + accent row, shown on the agent
 * profile screen.
 *
 * Two independent choices, deliberately kept as two plain grids rather than a
 * modal or a stepper: picking a mark is a two-second decision and interrupting
 * the screen for it would cost more than it's worth. Each half toggles, so the
 * same tap that sets a mark clears it — that keeps "back to default" reachable
 * without spending a Reset control or a line of explanatory caption on it.
 *
 * Both grids are five columns wide at every width (cells are `20%` less the
 * gap), so the two rows always land as a tidy 5×2 block instead of reflowing
 * to a ragged count on a larger screen.
 */

import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import {
  accentAlpha,
  agentAccentNames,
  agentAccentPalette,
  colors,
  radius,
  space,
  withAlpha,
} from '@/theme';
import { AGENT_AVATAR_IDS, AgentAvatar, accentHex, type AgentAvatarId } from './avatars';

type IdentityPickerProps = {
  avatarId: string | null;
  accentColor: string | null;
  onChange: (identity: { avatarId?: string | null; accentColor?: string | null }) => void;
};

export function IdentityPicker({ avatarId, accentColor, onChange }: IdentityPickerProps) {
  const tint = accentHex(accentColor);

  const pickGlyph = useCallback(
    (id: AgentAvatarId) => () => {
      Haptics.selectionAsync().catch(() => {});
      onChange({ avatarId: avatarId === id ? null : id });
    },
    [avatarId, onChange],
  );

  const pickAccent = useCallback(
    (name: string) => () => {
      Haptics.selectionAsync().catch(() => {});
      onChange({ accentColor: accentColor === name ? null : name });
    },
    [accentColor, onChange],
  );

  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        {AGENT_AVATAR_IDS.map((id) => {
          const selected = avatarId === id;
          return (
            <Pressable
              key={id}
              onPress={pickGlyph(id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${GLYPH_LABELS[id]} mark`}
              style={({ pressed }) => [
                styles.cell,
                pressed && styles.cellPressed,
                selected && styles.cellSelected,
                // The selection edge borrows the chosen accent when there is
                // one, so the two halves of the picker visibly agree.
                selected && tint ? { borderColor: withAlpha(tint, accentAlpha.line) } : null,
              ]}
            >
              {/* `size` is the tile footprint the glyph would sit in; the cell
                  supplies its own chrome here, so only the glyph is drawn. */}
              <AgentAvatar avatarId={id} accent={accentColor} size={46} bare />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.grid}>
        {agentAccentNames.map((name) => {
          const selected = accentColor === name;
          const hex = agentAccentPalette[name];
          return (
            <Pressable
              key={name}
              onPress={pickAccent(name)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${name} accent`}
              style={styles.swatchCell}
            >
              {/* The ring is a separate outer circle rather than a border on
                  the disc, so selecting never changes the disc's own size. */}
              <View
                style={[
                  styles.swatchRing,
                  selected && { borderColor: withAlpha(hex, accentAlpha.line) },
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: hex }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Spoken names for the marks — screen readers get a word, not a glyph id. */
const GLYPH_LABELS: Record<AgentAvatarId, string> = {
  ridge: 'Ridge',
  orbit: 'Orbit',
  stack: 'Stack',
  spark: 'Spark',
  dusk: 'Dusk',
  hex: 'Hex',
  prism: 'Prism',
  pulse: 'Pulse',
  peak: 'Peak',
  relay: 'Relay',
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.code + 4,
    padding: space.md,
    gap: space.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `18%` cells plus the gap keep exactly five per row at any container
    // width — six would need 108%, so the grid can never reflow to a ragged
    // count on a wider screen.
    gap: space.sm,
  },
  cell: {
    width: '18%',
    aspectRatio: 1,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellPressed: {
    backgroundColor: colors.hover,
  },
  cellSelected: {
    backgroundColor: colors.surface2,
    borderColor: colors.lineFocus,
  },
  swatchCell: {
    width: '18%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
});
