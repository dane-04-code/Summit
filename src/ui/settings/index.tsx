/**
 * Shared building blocks for the Settings screens — one grouped-inset list
 * system (screen shell, section label, card, row) reused by the hub and every
 * detail screen so type, spacing, and the tap affordance stay identical.
 *
 * Depth is tonal, never a border or shadow: the page is `bg`, a card is one
 * step up on `surface`, a pressed row is one step further on `hover`. Dividers
 * are hairlines inset to the label column, so a card reads as one object
 * instead of a stack of boxed rows.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';

import { ScreenHeader } from '@/ui/ScreenHeader';
import { colors, space, typography } from '@/theme';

// Card geometry — shared so the divider can line up under the label column.
const CARD_PAD = 16;
const ICON_COL = 22;
const ICON_GAP = 14;
const LABEL_INSET = CARD_PAD + ICON_COL + ICON_GAP;

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
          {i > 0 ? (
            // The divider hugs the label column of the row it introduces, so an
            // icon row and a plain row each start their rule under their text.
            <View style={[styles.divider, hasIcon(child) && styles.dividerInset]} />
          ) : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

function hasIcon(child: React.ReactNode): boolean {
  return React.isValidElement<{ icon?: React.ReactNode }>(child) && child.props.icon != null;
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
      {icon ? <View style={styles.iconCol}>{icon}</View> : null}
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.rowSub}>{sublabel}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right ?? (onPress ? <ChevronRight size={17} color={colors.faint} strokeWidth={2} /> : null)}
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

/** Card geometry, for screens that lay out custom content on the same grid. */
export const cardMetrics = { pad: CARD_PAD, iconCol: ICON_COL, iconGap: ICON_GAP } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  sectionLabel: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.muted,
    paddingHorizontal: CARD_PAD - 2,
    marginBottom: space.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginLeft: CARD_PAD,
  },
  dividerInset: { marginLeft: LABEL_INSET },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ICON_GAP,
    minHeight: 52,
    paddingVertical: 13,
    paddingHorizontal: CARD_PAD,
  },
  rowPressed: { backgroundColor: colors.hover },
  iconCol: {
    width: ICON_COL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 16, color: colors.ink, letterSpacing: -0.1 },
  rowLabelDanger: { color: colors.error },
  rowSub: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  rowValue: {
    ...typography.small,
    color: colors.muted,
    flexShrink: 1,
    textAlign: 'right',
  },
});
