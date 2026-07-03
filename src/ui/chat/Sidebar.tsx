/**
 * Conversation drawer — slides in from the left over a dimmed thread.
 * App identity · search · New chat · grouped recents · account footer,
 * per the Summit sidebar design.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanelLeftClose, Search, Plus, Settings, CalendarClock } from 'lucide-react-native';

import { colors, radius, space, typography } from '../../theme';
import type { ChatGroup, ChatSummary, RunState } from './types';

const DOT: Record<RunState, string> = {
  running: colors.accent,
  idle: colors.muted,
  error: colors.error,
};

const SCRIM_OPACITY = 0.55;

interface SidebarProps {
  visible: boolean;
  groups: ChatGroup[];
  activeId: string;
  title: string;
  subtitle: string;
  account: { name: string; initial: string };
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onOpenSettings: () => void;
  onOpenCron: () => void;
}

// ── Recent conversation row ─────────────────────────────────────────────────

function ChatRow({
  chat,
  active,
  onPress,
}: {
  chat: ChatSummary;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={chat.title}
      style={({ pressed }) => [
        styles.row,
        (active || pressed) && styles.rowActive,
      ]}
    >
      <View style={[styles.rowDot, { backgroundColor: DOT[chat.state] }]} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {chat.title}
        </Text>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {chat.preview}
        </Text>
      </View>
      <Text style={styles.rowTime}>{chat.time}</Text>
    </Pressable>
  );
}

export function Sidebar({
  visible,
  groups,
  activeId,
  title,
  subtitle,
  account,
  onClose,
  onNewChat,
  onSelectChat,
  onOpenSettings,
  onOpenCron,
}: SidebarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.84, 360);

  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [query, setQuery] = useState('');

  // Drive the slide/fade from `visible`; clear the search once fully closed.
  // (The panel stays mounted but off-screen + non-interactive when closed.)
  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 190,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setQuery('');
    });
  }, [visible, progress]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        chats: g.chats.filter(
          (c) =>
            c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.chats.length > 0);
  }, [groups, query]);

  const handleSelect = useCallback(
    (id: string) => () => onSelectChat(id),
    [onSelectChat],
  );

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-panelWidth - 1, 0],
  });
  const scrimOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCRIM_OPACITY],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sidebar"
        />
      </Animated.View>

      <Animated.View
        style={[styles.panel, { width: panelWidth, transform: [{ translateX }] }]}
      >
        {/* identity header */}
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          <View style={styles.identity}>
            <Text style={styles.appName} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.workspace} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close sidebar"
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressable]}
          >
            <PanelLeftClose size={20} color={colors.muted} strokeWidth={1.6} />
          </Pressable>
        </View>

        {/* search */}
        <View style={styles.searchWrap}>
          <View style={styles.search}>
            <Search size={17} color={colors.muted} strokeWidth={1.6} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search chats"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search chats"
            />
          </View>
        </View>

        {/* new chat */}
        <View style={styles.newChatWrap}>
          <Pressable
            onPress={onNewChat}
            accessibilityRole="button"
            accessibilityLabel="New chat"
            style={({ pressed }) => [styles.newChat, pressed && styles.newChatPressed]}
          >
            <Plus size={18} color={colors.onAccentBtn} strokeWidth={2} />
            <Text style={styles.newChatText}>New chat</Text>
          </Pressable>
        </View>

        {/* recents */}
        <ScrollView
          style={styles.recents}
          contentContainerStyle={styles.recentsContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No chats found</Text>
          ) : (
            filtered.map((group) => (
              <View key={group.label}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.chats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    active={chat.id === activeId}
                    onPress={handleSelect(chat.id)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>

        {/* account footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <Pressable
            onPress={onOpenCron}
            accessibilityRole="button"
            accessibilityLabel="Cron Drops"
            style={({ pressed }) => [styles.navRow, pressed && styles.pressable]}
          >
            <CalendarClock size={18} color={colors.muted} strokeWidth={1.6} />
            <Text style={styles.navLabel}>Cron Drops</Text>
          </Pressable>

          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel={`${account.name}, open settings`}
            style={({ pressed }) => [styles.account, pressed && styles.pressable]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{account.initial}</Text>
            </View>
            <View style={styles.identity}>
              <Text style={styles.accountName} numberOfLines={1}>
                {account.name}
              </Text>
              <Text style={styles.accountSub}>Settings</Text>
            </View>
            <Settings size={18} color={colors.muted} strokeWidth={1.4} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.drawer,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },

  // identity header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg + 2,
    paddingBottom: space.md + 2,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  appName: {
    ...typography.small,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.1,
  },
  workspace: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.code,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    backgroundColor: colors.surface2,
  },

  // search
  searchWrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 1,
    height: 42,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input - 2,
    paddingHorizontal: space.md + 1,
  },
  searchInput: {
    flex: 1,
    ...typography.small,
    color: colors.ink,
    padding: 0,
  },

  // new chat
  newChatWrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm - 2,
  },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    height: 44,
    backgroundColor: colors.ink,
    borderRadius: radius.input - 2,
    paddingHorizontal: space.md + 2,
  },
  newChatPressed: {
    opacity: 0.9,
  },
  newChatText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onAccentBtn,
  },

  // recents
  recents: {
    flex: 1,
  },
  recentsContent: {
    paddingHorizontal: space.sm + 2,
    paddingTop: space.md + 2,
    paddingBottom: space.sm,
  },
  groupLabel: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    paddingHorizontal: space.sm,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 1,
    borderRadius: 11,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm + 1,
  },
  rowActive: {
    backgroundColor: colors.hover,
  },
  rowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.small,
    color: colors.ink,
    lineHeight: 19,
  },
  rowPreview: {
    ...typography.caption,
    color: colors.muted,
    lineHeight: 17,
    marginTop: 1,
  },
  rowTime: {
    ...typography.caption,
    fontSize: 12,
    color: colors.muted,
  },
  empty: {
    ...typography.small,
    color: colors.muted,
    paddingHorizontal: space.sm,
    paddingTop: space.lg,
  },

  // account footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 1,
    borderRadius: radius.input - 2,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm + 2,
    marginBottom: space.xs,
  },
  navLabel: {
    ...typography.small,
    color: colors.ink,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 1,
    borderRadius: radius.input - 2,
    padding: space.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  accountName: {
    ...typography.small,
    fontWeight: '500',
    color: colors.ink,
    lineHeight: 18,
  },
  accountSub: {
    ...typography.caption,
    color: colors.muted,
    lineHeight: 16,
  },
});
