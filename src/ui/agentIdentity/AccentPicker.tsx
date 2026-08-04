/**
 * The agent accent picker — a single row of swatches shown on the agent
 * profile screen. The mark itself (the harness logo) isn't pickable; only
 * the tile's tint is, so this stays one plain grid rather than the two-grid
 * mark-plus-color picker it replaced.
 */

import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { accentAlpha, agentAccentNames, agentAccentPalette, colors, radius, space, withAlpha } from '@/theme';

type AccentPickerProps = {
  accentColor: string | null;
  onChange: (accentColor: string | null) => void;
};

export function AccentPicker({ accentColor, onChange }: AccentPickerProps) {
  const pickAccent = useCallback(
    (name: string) => () => {
      Haptics.selectionAsync().catch(() => {});
      onChange(accentColor === name ? null : name);
    },
    [accentColor, onChange],
  );

  return (
    <View style={styles.card}>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.code + 4,
    padding: space.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
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
});
