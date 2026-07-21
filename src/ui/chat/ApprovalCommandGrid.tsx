import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, radius, space, typography } from '@/theme';
import { CommandSnippet } from './CommandSnippet';
import type { ApprovalCommand, ApprovalOption } from './approvalPrompt';

type ApprovalCommandGridProps = {
  options: ApprovalOption[];
  onSelect: (command: ApprovalCommand) => void;
  resolvedCommand?: ApprovalCommand;
  command?: string;
};

export function ApprovalCommandGrid({
  options,
  onSelect,
  resolvedCommand,
  command,
}: ApprovalCommandGridProps) {
  const [selected, setSelected] = useState<ApprovalCommand | null>(null);
  const effectiveSelection = selected ?? resolvedCommand ?? null;
  const selectedOption = options.find((option) => option.command === effectiveSelection);

  const submit = useCallback(
    (command: ApprovalCommand) => {
      if (effectiveSelection) return;
      setSelected(command);
      Haptics.selectionAsync().catch(() => {});
      onSelect(command);
    },
    [effectiveSelection, onSelect],
  );

  const choose = useCallback(
    (command: ApprovalCommand) => {
      if (command !== '/approve always') {
        submit(command);
        return;
      }
      Alert.alert(
        'Always allow this command?',
        'Hermes will remember this permission for future sessions.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Always allow', onPress: () => submit(command) },
        ],
      );
    },
    [submit],
  );

  const rows = Array.from({ length: Math.ceil(options.length / 2) }, (_, index) =>
    options.slice(index * 2, index * 2 + 2),
  );

  return (
    <View
      style={styles.card}
      accessibilityLabel={effectiveSelection ? 'Approval decision sent' : 'Approval needed'}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          {effectiveSelection ? 'Decision sent' : 'Approval needed'}
        </Text>
        <Text style={styles.hint}>
          {selectedOption
            ? `Hermes received “${selectedOption.label}”.`
            : 'Choose how Hermes should handle this command.'}
        </Text>
        {command ? <CommandSnippet command={command} /> : null}
      </View>
      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            style={[styles.row, rowIndex > 0 && styles.rowDivider]}
          >
            {row.map((option, columnIndex) => {
              const isSelected = effectiveSelection === option.command;
              return (
                <Pressable
                  key={option.command}
                  onPress={() => choose(option.command)}
                  disabled={effectiveSelection !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}. ${option.detail}`}
                  accessibilityState={{ disabled: effectiveSelection !== null, selected: isSelected }}
                  style={({ pressed }) => [
                    styles.option,
                    columnIndex > 0 && styles.columnDivider,
                    option.command === '/deny' && styles.denyOption,
                    isSelected && styles.selectedOption,
                    pressed && !effectiveSelection && styles.pressedOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      option.command === '/deny' && styles.denyLabel,
                      isSelected && styles.selectedLabel,
                    ]}
                  >
                    {isSelected ? 'Sent' : option.label}
                  </Text>
                  <Text style={styles.optionDetail}>{option.detail}</Text>
                </Pressable>
              );
            })}
            {row.length === 1 ? <View style={styles.option} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.code,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    gap: space.xs,
  },
  eyebrow: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.ink2,
  },
  hint: {
    ...typography.caption,
    color: colors.muted,
  },
  grid: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  row: {
    flexDirection: 'row',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  option: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    justifyContent: 'center',
    gap: 2,
  },
  columnDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
  },
  pressedOption: {
    backgroundColor: colors.hover,
  },
  selectedOption: {
    backgroundColor: colors.accentLine,
  },
  denyOption: {
    backgroundColor: colors.errorSurface,
  },
  optionLabel: {
    ...typography.small,
    fontWeight: '600',
    color: colors.ink,
  },
  selectedLabel: {
    color: colors.accent,
  },
  denyLabel: {
    color: colors.error,
  },
  optionDetail: {
    ...typography.caption,
    color: colors.muted,
  },
});
