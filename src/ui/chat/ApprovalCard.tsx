/**
 * Approval request card — shown when the agent asks to run a blocking action.
 * Primary action is a light `ink` fill (per the design system, the accent is
 * never the primary button); Stop is a quiet outline.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';

import { colors, radius, space, typography } from '../../theme';
import { usePressAnim } from '../usePressAnim';
import { CommandSnippet } from './CommandSnippet';

interface ApprovalCardProps {
  title: string;
  command: string;
  onApprove: () => void;
  onStop: () => void;
}

export function ApprovalCard({ title, command, onApprove, onStop }: ApprovalCardProps) {
  const approveAnim = usePressAnim();
  const stopAnim = usePressAnim();

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Approval needed</Text>
      <Text style={styles.title}>{title}</Text>
      <CommandSnippet command={command} />
      <View style={styles.actions}>
        <Pressable
          onPress={onApprove}
          onPressIn={approveAnim.onPressIn}
          onPressOut={approveAnim.onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Approve"
          style={styles.actionPressable}
        >
          <Animated.View style={[styles.btn, styles.approveBtn, approveAnim.animStyle]}>
            <Text style={styles.approveText}>Approve</Text>
          </Animated.View>
        </Pressable>

        <Pressable
          onPress={onStop}
          onPressIn={stopAnim.onPressIn}
          onPressOut={stopAnim.onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Stop"
          style={styles.actionPressable}
        >
          <Animated.View style={[styles.btn, styles.stopBtn, stopAnim.animStyle]}>
            <Text style={styles.stopText}>Stop</Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: space.lg,
    gap: space.md,
  },
  label: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: 23,
    color: colors.ink,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm + 2,
    marginTop: 2,
  },
  actionPressable: {
    flex: 1,
  },
  btn: {
    height: 44,
    borderRadius: radius.input - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    backgroundColor: colors.ink,
  },
  approveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onAccentBtn,
  },
  stopBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
  },
  stopText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
  },
});
