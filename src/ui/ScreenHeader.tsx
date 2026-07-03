/**
 * The one screen header — back · title (+ optional subtitle) · optional
 * trailing accessories. Every pushed screen (settings, cron, pair) uses this
 * so chrome type, spacing, and the back affordance are identical app-wide.
 * The chat screen keeps its specialized header (menu · status · new chat).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { colors, radius, space, typography } from '@/theme';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  /** A string gets the standard muted caption style; a node renders as-is. */
  subtitle?: React.ReactNode;
  /** Defaults to `router.back()`. */
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
      >
        <ChevronLeft size={22} color={colors.muted} strokeWidth={1.9} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle == null ? null : typeof subtitle === 'string' ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
  },
});
