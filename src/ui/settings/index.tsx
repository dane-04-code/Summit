/**
 * Shared building blocks for the Settings screens — a faithful port of Avery's
 * iOS settings design (Agent Messenger – Settings.dc.html) onto theme tokens.
 * One card system, section labels, and rows, reused by the hub and its detail
 * screens so they stay visually identical.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';

import { ScreenHeader } from '@/ui/ScreenHeader';
import { colors, space, typography } from '@/theme';

// ── Screen shell (shared ScreenHeader chrome) ───────────────────────────────────

export function SettingsScreen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={title} />
      {children}
    </SafeAreaView>
  );
}

// ── Section label above a card group ───────────────────────────────────────────

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// ── Card group — inserts hairline dividers between its rows automatically ───────

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.card, style]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

type RowProps = {
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
};

export function Row({ icon, label, sublabel, value, onPress, right, danger, disabled }: RowProps) {
  const body = (
    <View style={styles.row}>
      {icon ? <View style={styles.iconBox}>{icon}</View> : null}
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSub}>{sublabel}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right ?? (onPress ? <ChevronRight size={17} color={colors.muted} strokeWidth={1.5} /> : null)}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  sectionLabel: {
    ...typography.caption,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    marginBottom: space.sm,
  },

  card: {
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.surface2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowPressed: { backgroundColor: colors.surface },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 16, color: colors.ink },
  rowLabelDanger: { color: colors.error },
  rowSub: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 1,
  },
  rowValue: {
    ...typography.small,
    color: colors.muted,
  },
});
