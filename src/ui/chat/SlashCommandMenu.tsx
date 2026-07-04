/**
 * The `/` command menu — a small overlay pinned above the composer that lists
 * the commands matching what the user has typed. Presentational only: the
 * parent filters (`matchCommands`) and handles selection.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { colors, radius, space, typography } from '../../theme';
import type { SlashCommand } from './slashCommands';

export function SlashCommandMenu({
  commands,
  onSelect,
}: {
  commands: SlashCommand[];
  onSelect: (cmd: SlashCommand) => void;
}) {
  if (commands.length === 0) return null;
  return (
    <View style={styles.menu}>
      {commands.map((cmd, i) => (
        <Pressable
          key={cmd.name}
          onPress={() => onSelect(cmd)}
          style={[styles.row, i > 0 && styles.rowDivider]}
          accessibilityRole="button"
          accessibilityLabel={`/${cmd.name} — ${cmd.description}`}
        >
          <Text style={styles.name}>/{cmd.name}</Text>
          <Text style={styles.desc} numberOfLines={1}>
            {cmd.description}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  name: {
    ...typography.mono,
    color: colors.ink,
  },
  desc: {
    ...typography.small,
    color: colors.muted,
    flexShrink: 1,
  },
});
