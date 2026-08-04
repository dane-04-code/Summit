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
  Modal,
  Platform,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PanelLeftClose,
  Search,
  Plus,
  Settings,
  CalendarClock,
  ChevronDown,
  Check,
} from 'lucide-react-native';

import { colors, radius, space, typography } from '../../theme';
import { AgentAvatar, accentHex } from '@/ui/agentIdentity/avatars';
import type { ConnectionState } from '@/agents/adapters/types';
import { ConnectionBadge } from './ConnectionBadge';
import type { ChatGroup, ChatSummary, RunState } from './types';

/**
 * The recents dot. `running` and `error` are live signals and always win, so a
 * chosen agent color can never mask a failed or in-flight run. Only the idle
 * dot — every row's state today, and otherwise a flat grey that says nothing —
 * carries the active agent's accent, which makes an open drawer read as
 * belonging to that agent at a glance.
 */
function dotColor(state: RunState, accent: string | null): string {
  if (state === 'running') return colors.accent;
  if (state === 'error') return colors.error;
  return accent ?? colors.muted;
}

const SCRIM_OPACITY = 0.55;

/** One paired agent, as the switcher needs it. */
export type AgentOption = {
  id: string;
  name: string;
  framework: string;
  frameworkLabel: string;
  /** User-chosen accent tint; absent renders the neutral default. */
  accentColor?: string | null;
};

interface SidebarProps {
  visible: boolean;
  groups: ChatGroup[];
  activeId: string;
  title: string;
  subtitle: string;
  /** Every paired agent, most-recent-first. One entry = no switcher chrome. */
  agents: AgentOption[];
  activeAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onAddAgent: () => void;
  connectionState: ConnectionState;
  onRetryConnection?: () => void;
  account: { name: string; initial: string };
  /** Capability-gated: only agents with jobs get the Cron Jobs entry. */
  showCron: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onDeleteChat: (id: string) => void;
  onOpenSettings: () => void;
  onOpenCron: () => void;
}

// ── Recent conversation row ─────────────────────────────────────────────────

function ChatRow({
  chat,
  active,
  accent,
  onPress,
  onLongPress,
}: {
  chat: ChatSummary;
  active: boolean;
  /** Resolved hex for the active agent's accent, or null. */
  accent: string | null;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={chat.title}
      style={({ pressed }) => [
        styles.row,
        (active || pressed) && styles.rowActive,
      ]}
    >
      <View style={[styles.rowDot, { backgroundColor: dotColor(chat.state, accent) }]} />
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

// ── Agent switcher row ──────────────────────────────────────────────────────

function AgentRow({
  agent,
  active,
  onPress,
}: {
  agent: AgentOption;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${agent.name}, ${agent.frameworkLabel}`}
      style={({ pressed }) => [styles.agentRow, (active || pressed) && styles.rowActive]}
    >
      {/* One mark carries both halves of the identity: the harness logo and the
          accent tint that fills its tile. A separate color dot alongside would
          say the same thing twice, and this row already ends in a check. */}
      <AgentAvatar framework={agent.framework} accent={agent.accentColor} size={28} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {agent.name}
        </Text>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {agent.frameworkLabel}
        </Text>
      </View>
      {active ? <Check size={16} color={colors.ink} strokeWidth={2} /> : null}
    </Pressable>
  );
}

export function Sidebar({
  visible,
  groups,
  activeId,
  title,
  subtitle,
  agents,
  activeAgentId,
  onSelectAgent,
  onAddAgent,
  connectionState,
  onRetryConnection,
  account,
  showCron,
  onClose,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onOpenSettings,
  onOpenCron,
}: SidebarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.84, 360);

  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  const [query, setQuery] = useState('');
  const [renameTarget, setRenameTarget] = useState<ChatSummary | null>(null);
  const [renameText, setRenameText] = useState('');
  const [agentsOpen, setAgentsOpen] = useState(false);

  // One agent is the common case: the identity block stays a plain label and
  // nothing about multi-agent is visible until a second one is paired.
  const canSwitchAgents = agents.length > 1;

  // Derived from the agent list rather than taken as a prop, so the drawer can
  // never show one agent's name in another's color.
  const activeAccent = useMemo(
    () => accentHex(agents.find((a) => a.id === activeAgentId)?.accentColor),
    [agents, activeAgentId],
  );

  // Drive the slide/fade from `visible`; clear the search once fully closed.
  // (The panel stays mounted but off-screen + non-interactive when closed.)
  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 190,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) {
        setQuery('');
        setAgentsOpen(false);
      }
    });
  }, [visible, progress]);

  // A second agent can be removed while the list is open; collapse rather than
  // leave a one-row expander behind.
  useEffect(() => {
    if (!canSwitchAgents) setAgentsOpen(false);
  }, [canSwitchAgents]);

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

  const handleChatActions = useCallback(
    (chat: ChatSummary) => {
      const openRename = () => {
        setRenameTarget(chat);
        setRenameText(chat.title);
      };
      const confirmDelete = () =>
        Alert.alert('Delete chat', 'This removes the conversation from this device.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDeleteChat(chat.id) },
        ]);
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: chat.title,
            options: ['Cancel', 'Rename', 'Delete'],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 0,
          },
          (i) => {
            if (i === 1) openRename();
            if (i === 2) confirmDelete();
          },
        );
      } else {
        Alert.alert(chat.title, undefined, [
          { text: 'Rename', onPress: openRename },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    },
    [onDeleteChat],
  );

  const commitRename = useCallback(() => {
    if (renameTarget) onRenameChat(renameTarget.id, renameText);
    setRenameTarget(null);
  }, [renameTarget, renameText, onRenameChat]);

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
        {/* identity header — doubles as the agent switcher once >1 is paired */}
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          <Pressable
            disabled={!canSwitchAgents}
            onPress={() => setAgentsOpen((open) => !open)}
            accessibilityRole={canSwitchAgents ? 'button' : undefined}
            accessibilityLabel={canSwitchAgents ? `${title}, switch agent` : undefined}
            accessibilityState={canSwitchAgents ? { expanded: agentsOpen } : undefined}
            style={({ pressed }) => [
              styles.identity,
              canSwitchAgents && styles.identityTappable,
              canSwitchAgents && pressed && styles.pressable,
            ]}
          >
            <View style={styles.identityLine}>
              {/* The agent's name carries its own accent — the one place the
                  drawer names who you're talking to, so it's the one place the
                  color is worth spending. */}
              <Text
                style={[styles.appName, activeAccent ? { color: activeAccent } : null]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {canSwitchAgents ? (
                <View style={agentsOpen ? styles.chevronOpen : undefined}>
                  <ChevronDown size={15} color={colors.muted} strokeWidth={1.8} />
                </View>
              ) : null}
            </View>
            <Text style={styles.workspace} numberOfLines={1}>
              {subtitle}
            </Text>
            <View style={styles.connectionLine}>
              <ConnectionBadge
                state={connectionState}
                onRetry={onRetryConnection}
                compact
              />
            </View>
          </Pressable>
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

        {/* agent switcher */}
        {canSwitchAgents && agentsOpen ? (
          <View style={styles.agentList}>
            {agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                active={agent.id === activeAgentId}
                onPress={() => {
                  setAgentsOpen(false);
                  onSelectAgent(agent.id);
                }}
              />
            ))}
            <Pressable
              onPress={() => {
                setAgentsOpen(false);
                onAddAgent();
              }}
              accessibilityRole="button"
              accessibilityLabel="Add another agent"
              style={({ pressed }) => [styles.agentAddRow, pressed && styles.rowActive]}
            >
              {/* Sits in the same 28px column as the agent marks above, so the
                  labels of every row in the list share one left edge. */}
              <View style={styles.agentAddIcon}>
                <Plus size={16} color={colors.muted} strokeWidth={1.8} />
              </View>
              <Text style={styles.agentAddLabel}>Add another agent</Text>
            </Pressable>
          </View>
        ) : null}

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
                    accent={activeAccent}
                    onPress={handleSelect(chat.id)}
                    onLongPress={() => handleChatActions(chat)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>

        {/* account footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          {showCron ? (
            <Pressable
              onPress={onOpenCron}
              accessibilityRole="button"
              accessibilityLabel="Cron Jobs"
              style={({ pressed }) => [styles.navRow, pressed && styles.pressable]}
            >
              <CalendarClock size={18} color={colors.muted} strokeWidth={1.6} />
              <Text style={styles.navLabel}>Cron Jobs</Text>
            </Pressable>
          ) : null}

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

      {/* rename modal */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalScrim} onPress={() => setRenameTarget(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename chat</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={commitRename}
              accessibilityLabel="Chat name"
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setRenameTarget(null)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.modalBtn, pressed && styles.pressable]}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={commitRename}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  pressed && styles.modalBtnPrimaryPressed,
                ]}
              >
                <Text style={styles.modalBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: colors.scrim,
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
  // Only the switchable form takes a hit target + press surface; a single-agent
  // header stays a plain label with no affordance to misread.
  identityTappable: {
    borderRadius: radius.control,
    marginLeft: -space.sm,
    paddingLeft: space.sm,
    paddingVertical: space.xs,
  },
  identityLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 1,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  appName: {
    ...typography.small,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  workspace: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 2,
  },
  connectionLine: {
    marginTop: 4,
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

  // agent switcher
  agentList: {
    paddingHorizontal: space.sm + 2,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    marginBottom: space.md,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 1,
    borderRadius: radius.control,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm + 1,
  },
  agentAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 1,
    borderRadius: radius.control,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm + 1,
  },
  agentAddIcon: {
    width: 28,
    alignItems: 'center',
  },
  agentAddLabel: {
    ...typography.small,
    color: colors.muted,
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
    borderRadius: radius.control,
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

  // rename modal
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  modalScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
    opacity: SCRIM_OPACITY,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    padding: space.lg,
    gap: space.md,
  },
  modalTitle: {
    ...typography.small,
    fontWeight: '600',
    color: colors.ink,
  },
  modalInput: {
    ...typography.body,
    color: colors.ink,
    height: 44,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
  modalBtn: {
    height: 38,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: colors.ink,
  },
  modalBtnPrimaryPressed: {
    opacity: 0.9,
  },
  modalBtnText: {
    ...typography.small,
    color: colors.muted,
  },
  modalBtnPrimaryText: {
    ...typography.small,
    fontWeight: '600',
    color: colors.onAccentBtn,
  },
});
