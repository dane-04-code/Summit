/**
 * Agent chat header - menu, agent name, live status, and new chat.
 * Sits directly under the top safe-area inset.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Menu, SquarePen } from 'lucide-react-native';

import type { ConnectionState } from '@/agents/adapters/types';
import { colors, radius, space, typography } from '../../theme';
import type { RunState } from './types';
import { ConnectionBadge } from './ConnectionBadge';

const DOT: Record<RunState, string> = {
  running: colors.accent,
  idle: colors.muted,
  error: colors.error,
};

interface HeaderProps {
  name: string;
  status: RunState;
  statusLabel: string;
  connectionState: ConnectionState;
  frameworkLabel: string;
  hint?: string | null;
  onRetryConnection?: () => void;
  onOpenProfile: () => void;
  onMenu: () => void;
  onNewChat: () => void;
}

function HeaderButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
    >
      {children}
    </Pressable>
  );
}

export function Header({
  name,
  status,
  statusLabel,
  connectionState,
  frameworkLabel,
  hint,
  onRetryConnection,
  onOpenProfile,
  onMenu,
  onNewChat,
}: HeaderProps) {
  const showHint = status === 'running' && !!hint;

  return (
    <View style={styles.header}>
      <HeaderButton label="Open menu" onPress={onMenu}>
        <Menu size={22} color={colors.muted} strokeWidth={1.8} />
      </HeaderButton>

      <View style={styles.center}>
        <Pressable
          onPress={onOpenProfile}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`View ${name} profile`}
          style={({ pressed }) => pressed && styles.titlePressed}
        >
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
        <View
          style={styles.statusRow}
          accessibilityLabel={`Status: ${statusLabel}${showHint ? `, ${hint}` : ''}`}
        >
          {status === 'running' ? (
            <>
              <View style={[styles.dot, { backgroundColor: DOT[status] }]} />
              <Text style={styles.statusLabel} numberOfLines={1}>
                {statusLabel}
                {showHint ? <Text style={styles.hint}>{` - ${hint}`}</Text> : null}
              </Text>
            </>
          ) : (
            <ConnectionBadge
              state={connectionState}
              prefix={frameworkLabel}
              onRetry={onRetryConnection}
            />
          )}
        </View>
      </View>

      <HeaderButton label="New chat" onPress={onNewChat}>
        <SquarePen size={20} color={colors.muted} strokeWidth={1.6} />
      </HeaderButton>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: 0,
  },
  titlePressed: { opacity: 0.65 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    marginTop: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.ink,
    flexShrink: 1,
  },
  hint: {
    color: colors.muted,
  },
});
