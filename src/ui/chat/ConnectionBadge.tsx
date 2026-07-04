import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ConnectionState } from '@/agents/adapters/types';
import { colors, radius, space, typography } from '@/theme';

type Tone = 'muted' | 'ok' | 'busy' | 'error';

const META: Record<ConnectionState, { label: string; tone: Tone }> = {
  unknown: { label: 'Not checked', tone: 'muted' },
  connecting: { label: 'Connecting...', tone: 'busy' },
  connected: { label: 'Connected', tone: 'ok' },
  reconnecting: { label: 'Reconnecting...', tone: 'busy' },
  disconnected: { label: 'Agent disconnected', tone: 'error' },
  pairing_expired: { label: 'Pairing expired', tone: 'error' },
};

const DOT: Record<Tone, string> = {
  muted: colors.muted,
  ok: colors.success,
  busy: colors.accent,
  error: colors.error,
};

export function connectionLabel(state: ConnectionState): string {
  return META[state].label;
}

export function isConnectionUnavailable(state: ConnectionState): boolean {
  return state === 'disconnected' || state === 'pairing_expired';
}

export function ConnectionBadge({
  state,
  prefix,
  onRetry,
  compact = false,
}: {
  state: ConnectionState;
  prefix?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const meta = META[state];
  const isBusy = state === 'connecting' || state === 'reconnecting';
  const label = prefix ? `${prefix} - ${meta.label}` : meta.label;

  return (
    <View style={styles.row} accessibilityLabel={`Connection: ${label}`}>
      {isBusy ? (
        <ActivityIndicator size="small" color={DOT[meta.tone]} />
      ) : (
        <View style={[styles.dot, { backgroundColor: DOT[meta.tone] }]} />
      )}
      <Text style={[styles.label, compact && styles.compactLabel]} numberOfLines={1}>
        {label}
      </Text>
      {onRetry && isConnectionUnavailable(state) ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    minWidth: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    ...typography.caption,
    color: colors.ink,
    flexShrink: 1,
  },
  compactLabel: {
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  retry: {
    borderRadius: radius.control,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    backgroundColor: colors.surface2,
  },
  retryPressed: {
    opacity: 0.84,
  },
  retryText: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '600',
  },
});
