/**
 * Agent chat screen — Summit.
 * Header + hybrid message thread + composer, per the Summit design.
 * The thread is restored from the active agent's most recent saved session and
 * live sends stream through the agent adapter. (The sidebar still reads seed
 * data — wired in the history slice.)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { ArrowUp, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { colors, space, radius, typography, screenPadding } from '@/theme';
import { usePressAnim } from '@/ui/usePressAnim';
import { Header } from '@/ui/chat/Header';
import { AgentMessage } from '@/ui/chat/AgentMessage';
import { ApprovalCard } from '@/ui/chat/ApprovalCard';
import { Sidebar } from '@/ui/chat/Sidebar';
import { MdReader } from '@/ui/chat/MdReader';
import { useAuth } from '@/context/AuthContext';
import type { Message, AgentBlock, RunState, MarkdownFile, ChatGroup } from '@/ui/chat/types';
import { useAgents } from '@/agents/AgentProvider';
import { initialTurn, reduceTurn, turnToBlocks, settleBlocks, shouldFlush } from '@/ui/chat/streamReducer';
import type { ChatSession } from '@/agents/types';

// ---------------------------------------------------------------------------
// Live streaming helpers
// ---------------------------------------------------------------------------

const AGENT_NAME = 'Hermes';
const RUNNING_HINT = 'working…';

const COMPOSER_MIN_HEIGHT = 24;
const COMPOSER_MAX_HEIGHT = 120;
const COMPOSER_VERTICAL_CHROME = 20;

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Build an agent message whose single text block holds `text`. */
function agentText(id: string, text: string): Message {
  const blocks: AgentBlock[] = [{ kind: 'text', spans: [{ text }] }];
  return { id, role: 'agent', blocks };
}

function previewText(message: Message | null): string {
  if (!message) return 'No messages yet';
  if (message.role === 'user') return message.text;
  if (message.role === 'action') return message.command;
  const first = message.blocks[0];
  if (!first) return 'Agent reply';
  if (first.kind === 'markdown') return first.source.replace(/\s+/g, ' ').trim() || 'Agent reply';
  if (first.kind === 'text') return first.spans.map((s) => s.text).join('').trim() || 'Agent reply';
  if (first.kind === 'heading') return first.text;
  if (first.kind === 'code') return 'Code snippet';
  if (first.kind === 'table') return 'Table';
  if (first.kind === 'file') return first.file.name;
  if (first.kind === 'chip') return first.label;
  return 'Agent reply';
}

function formatSessionTime(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'now';
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function sessionGroupLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// MessageRow
// ---------------------------------------------------------------------------

function MessageRow({
  message,
  onApprove,
  onStop,
  onOpenFile,
}: {
  message: Message;
  onApprove: (id: string) => void;
  onStop: (id: string) => void;
  onOpenFile: (file: MarkdownFile) => void;
}) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  if (message.role === 'action') {
    return (
      <View style={styles.block}>
        <ApprovalCard
          title={message.title}
          command={message.command}
          onApprove={() => onApprove(message.id)}
          onStop={() => onStop(message.id)}
        />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <AgentMessage blocks={message.blocks} onOpenFile={onOpenFile} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// AgentScreen
// ---------------------------------------------------------------------------

export default function AgentScreen() {
  const { activeAgent, adapterFor, repo } = useAgents();
  const { user } = useAuth();
  const accountName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'You';
  const account = { name: accountName, initial: accountName[0]?.toUpperCase() ?? '?' };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<RunState>('idle');
  // True only while a live reply is streaming — gates the composer.
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openFile, setOpenFile] = useState<MarkdownFile | null>(null);
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [composerHeight, setComposerHeight] = useState(COMPOSER_MIN_HEIGHT);

  const flashListRef = useRef<FlashListRef<Message>>(null);
  const inputRef = useRef<TextInput>(null);
  const sessionRef = useRef<ChatSession | null>(null);
  const cancelledRef = useRef(false);
  // Set by the stop button; the stream loop checks it and ends the turn early.
  const stopRef = useRef(false);
  const insets = useSafeAreaInsets();
  const sendAnim = usePressAnim({ scale: 0.9 });

  // Smoothly lift the input border from grey → lighter grey on focus.
  const focusAnim = useRef(new Animated.Value(0)).current;
  const animateFocus = useCallback(
    (to: number) =>
      Animated.timing(focusAnim, {
        toValue: to,
        duration: 160,
        useNativeDriver: false, // border colour can't run on the native driver
      }).start(),
    [focusAnim],
  );
  const fieldBorderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.line, colors.lineFocus],
  });

  const canSend = input.trim().length > 0 && !streaming;

  // Guard against setState after the screen unmounts mid-stream.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const loadSessionSummaries = useCallback(async () => {
    if (!activeAgent) {
      setChatGroups([]);
      return;
    }
    const sessions = await repo.listSessions(activeAgent.id);
    const summaries = await Promise.all(
      sessions.map(async (session) => {
        const stored = await repo.listMessages(session.id);
        const first = stored[0]?.message ?? null;
        const last = stored[stored.length - 1]?.message ?? null;
        return {
          session,
          chat: {
            id: session.id,
            title: session.title ?? previewText(first).slice(0, 40),
            preview: previewText(last),
            time: formatSessionTime(session.updatedAt),
            state: 'idle' as const,
          },
        };
      }),
    );
    const nextGroups: ChatGroup[] = [];
    for (const { session, chat } of summaries) {
      const label = sessionGroupLabel(session.updatedAt);
      const group = nextGroups.find((g) => g.label === label);
      if (group) group.chats.push(chat);
      else nextGroups.push({ label, chats: [chat] });
    }
    setChatGroups(nextGroups);
  }, [activeAgent, repo]);

  const loadSession = useCallback(
    async (session: ChatSession | null) => {
      sessionRef.current = session;
      setActiveSessionId(session?.id ?? '');
      if (!session) {
        setMessages([]);
        return;
      }
      const stored = await repo.listMessages(session.id);
      setMessages(stored.map((s) => s.message));
    },
    [repo],
  );

  // Restore the most recent thread for the active agent (docs/AGENTS.md §6).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeAgent) {
        if (!cancelled) {
          await loadSession(null);
          setChatGroups([]);
        }
        return;
      }
      const sessions = await repo.listSessions(activeAgent.id); // newest-first
      const latest = sessions[0] ?? null;
      if (cancelled) return;
      await loadSession(latest);
      if (!cancelled) await loadSessionSummaries();
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAgent, repo, loadSession, loadSessionSummaries]);

  const statusLabel =
    status === 'running' ? 'running' : status === 'error' ? 'connection error' : 'ready';
  const sidebarTitle = activeAgent?.name ?? 'Summit';
  const sidebarSubtitle = activeAgent
    ? activeAgent.framework === 'hermes' ? 'Hermes' : 'OpenClaw'
    : 'No agent connected';

  const handleNewChat = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    sessionRef.current = null;
    setActiveSessionId('');
    setMessages([]);
    setInput('');
    setComposerHeight(COMPOSER_MIN_HEIGHT);
    setStreaming(false);
    setStatus('idle');
    setSidebarOpen(false);
  }, []);

  // Web auto-grow. react-native-web reports `textarea.scrollHeight` for
  // `onContentSizeChange`, and scrollHeight is `max(content, clientHeight)` —
  // so measuring while our own height is applied makes the box ratchet to its
  // cap and never shrink. Collapse to 0 first to read the true content height.
  const measureComposer = useCallback((text: string) => {
    setInput(text);
    if (Platform.OS !== 'web') return;
    const node = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!node) return;
    const applied = node.style.height;
    node.style.height = '0px';
    const contentHeight = node.scrollHeight;
    node.style.height = applied;
    setComposerHeight(
      Math.min(COMPOSER_MAX_HEIGHT, Math.max(COMPOSER_MIN_HEIGHT, contentHeight)),
    );
  }, []);

  const handleMenu = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setSidebarOpen(true);
  }, []);

  const handleOpenFile = useCallback((file: MarkdownFile) => {
    Haptics.selectionAsync().catch(() => {});
    setOpenFile(file);
  }, []);

  const handleSelectChat = useCallback(
    async (id: string) => {
      const session = await repo.getSession(id);
      if (!session) return;
      Haptics.selectionAsync().catch(() => {});
      await loadSession(session);
      setSidebarOpen(false);
    },
    [loadSession, repo],
  );

  const handleOpenSettings = useCallback(() => {
    setSidebarOpen(false);
    router.push('/(app)/settings');
  }, []);

  const handleOpenCron = useCallback(() => {
    setSidebarOpen(false);
    router.push('/(app)/cron');
  }, []);

  const handleApprove = useCallback((id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? agentText(`${id}-result`, 'Approved — running the command now.')
          : m,
      ),
    );
  }, []);

  const handleStop = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? agentText(`${id}-result`, 'Stopped. Nothing was run.') : m)),
    );
  }, []);

  const ensureSession = useCallback(async (): Promise<ChatSession> => {
    if (sessionRef.current) return sessionRef.current;
    const now = Date.now();
    const session: ChatSession = {
      id: genId(),
      agentId: activeAgent!.id,
      title: null,
      remoteSessionKey: genId(), // stable channel identity for X-Hermes-Session-Key
      createdAt: now,
      updatedAt: now,
    };
    await repo.upsertSession(session);
    sessionRef.current = session;
    setActiveSessionId(session.id);
    return session;
  }, [activeAgent, repo]);

  const handleStopStream = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    stopRef.current = true;
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !activeAgent) return;
    stopRef.current = false;
    setInput('');
    setComposerHeight(COMPOSER_MIN_HEIGHT);

    const session = await ensureSession();
    const now = Date.now();
    const userMsg: Message = { id: genId(), role: 'user', text };
    await repo.appendMessage({ id: userMsg.id, sessionId: session.id, message: userMsg, createdAt: now });

    const agentId = genId();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: agentId, role: 'agent', blocks: [{ kind: 'markdown', source: '' }] },
    ]);
    setStreaming(true);
    setStatus('running');
    // One deliberate scroll to the send; while streaming, FlashList's
    // maintainVisibleContentPosition follows the bottom only when the reader
    // is already there — scrolling up to read is never fought.
    setTimeout(() => flashListRef.current?.scrollToEnd({ animated: true }), 50);

    let turn = initialTurn;
    let lastFlushAt = 0;
    try {
      const stream = adapterFor(activeAgent).sendMessage(text, {
        sessionId: session.id,
        sessionKey: session.remoteSessionKey ?? undefined,
      });
      for await (const event of stream) {
        if (stopRef.current) break;
        turn = reduceTurn(turn, event);
        if (cancelledRef.current) return;
        const now = Date.now();
        if (shouldFlush(lastFlushAt, now, turn.done)) {
          lastFlushAt = now;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentId ? { id: agentId, role: 'agent', blocks: turnToBlocks(turn) } : m,
            ),
          );
        }
        if (turn.done) break;
      }
    } catch {
      turn = { ...turn, status: 'error', error: 'The connection to the agent dropped.', done: true };
    }

    if (cancelledRef.current) return;
    setStreaming(false);

    // A reply stopped before any text arrived just disappears — nothing to keep.
    if (stopRef.current && turn.text.trim() === '') {
      setStatus('idle');
      setMessages((prev) => prev.filter((m) => m.id !== agentId));
      return;
    }

    if (turn.status === 'error') {
      setStatus('error');
      const errorMsg: Message = {
        id: agentId,
        role: 'agent',
        blocks: [
          { kind: 'text', spans: [{ text: turn.error ?? 'Something went wrong.' }], tone: 'muted' },
        ],
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentId ? errorMsg : m,
        ),
      );
      await repo.appendMessage({ id: agentId, sessionId: session.id, message: errorMsg, createdAt: Date.now() });
      const title = session.title ?? text.slice(0, 40);
      const updated: ChatSession = { ...session, title, updatedAt: Date.now() };
      await repo.upsertSession(updated);
      sessionRef.current = updated;
      setActiveSessionId(updated.id);
      await loadSessionSummaries();
      return;
    }

    setStatus('idle');
    const settled: Message = { id: agentId, role: 'agent', blocks: settleBlocks(turn.text) };
    // Snap from streaming markdown to the settled form (file card for pasted .md content, etc.)
    setMessages((prev) => prev.map((m) => (m.id === agentId ? settled : m)));
    await repo.appendMessage({ id: agentId, sessionId: session.id, message: settled, createdAt: Date.now() });
    const title = session.title ?? text.slice(0, 40);
    const updated: ChatSession = { ...session, title, updatedAt: Date.now() };
    await repo.upsertSession(updated);
    sessionRef.current = updated;
    setActiveSessionId(updated.id);
    await loadSessionSummaries();
  }, [input, streaming, activeAgent, adapterFor, repo, ensureSession, loadSessionSummaries]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      {/*
       * Top + sides handled by SafeAreaView.
       * Bottom safe area is applied directly to the input bar so it doesn't
       * jump when the keyboard raises (KeyboardAvoidingView owns the bottom).
       */}
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Header
          name={activeAgent?.name ?? AGENT_NAME}
          status={status}
          statusLabel={statusLabel}
          hint={RUNNING_HINT}
          onMenu={handleMenu}
          onNewChat={handleNewChat}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlashList<Message>
            ref={flashListRef}
            data={messages}
            renderItem={({ item }) => (
              <MessageRow
                message={item}
                onApprove={handleApprove}
                onStop={handleStop}
                onOpenFile={handleOpenFile}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            maintainVisibleContentPosition={{
              autoscrollToBottomThreshold: 120,
              animateAutoScrollToBottom: true,
              startRenderingFromBottom: true,
            }}
          />

          {/* ── Input bar — pinned above keyboard ─────────── */}
          <View
            style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, space.md) }]}
          >
            <Animated.View
              style={[
                styles.fieldWrap,
                {
                  borderColor: fieldBorderColor,
                  height: Math.max(44, composerHeight + COMPOSER_VERTICAL_CHROME),
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[styles.textField, { height: composerHeight }]}
                value={input}
                onChangeText={measureComposer}
                placeholder="Message…"
                placeholderTextColor={colors.muted}
                onFocus={() => animateFocus(1)}
                onBlur={() => animateFocus(0)}
                autoCorrect
                multiline
                scrollEnabled={composerHeight >= COMPOSER_MAX_HEIGHT}
                // Native only: iOS/Android report a frame-independent content
                // size, so this settles. Web is handled in `measureComposer` —
                // wiring it here would re-introduce the scrollHeight ratchet.
                onContentSizeChange={
                  Platform.OS === 'web'
                    ? undefined
                    : (event) => {
                        // Small buffer so the last line never clips the frame.
                        setComposerHeight(
                          Math.min(
                            COMPOSER_MAX_HEIGHT,
                            Math.max(
                              COMPOSER_MIN_HEIGHT,
                              event.nativeEvent.contentSize.height + 2,
                            ),
                          ),
                        );
                      }
                }
                textAlignVertical="top"
                accessibilityLabel="Message input"
              />
            </Animated.View>

            <Pressable
              onPress={streaming ? handleStopStream : handleSend}
              onPressIn={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                sendAnim.onPressIn();
              }}
              onPressOut={sendAnim.onPressOut}
              disabled={!streaming && !canSend}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={streaming ? 'Stop reply' : 'Send message'}
              accessibilityState={{ disabled: !streaming && !canSend }}
            >
              <Animated.View
                style={[
                  styles.sendBtn,
                  sendAnim.animStyle,
                  !streaming && !canSend && styles.sendBtnDisabled,
                ]}
              >
                {streaming ? (
                  <Square
                    size={14}
                    color={colors.onAccentBtn}
                    fill={colors.onAccentBtn}
                    strokeWidth={2}
                  />
                ) : (
                  <ArrowUp size={20} color={colors.onAccentBtn} strokeWidth={2.5} />
                )}
              </Animated.View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Sidebar
        visible={sidebarOpen}
        groups={chatGroups}
        activeId={activeSessionId}
        title={sidebarTitle}
        subtitle={sidebarSubtitle}
        account={account}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onOpenSettings={handleOpenSettings}
        onOpenCron={handleOpenCron}
      />

      <MdReader file={openFile} onClose={() => setOpenFile(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles — no raw hex; tokens for colour, spacing, radius, and type
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },

  // ── Message list ──────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: screenPadding - 6,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },

  // Spacing between thread items (FlashList renders rows individually)
  block: {
    marginVertical: space.md - 2,
  },

  // ── User bubble (right-aligned) ───────────────────────────────────────────
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: space.md - 2,
  },
  userBubble: {
    backgroundColor: colors.bubble,
    borderRadius: radius.bubble,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 1,
    maxWidth: '80%',
  },
  userText: {
    ...typography.body,
    color: colors.ink,
  },

  // ── Input bar ─────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end', // keep Send pinned to the bottom as the field grows
    gap: space.sm + 2,
    paddingHorizontal: space.lg,
    paddingTop: space.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  // Box chrome lives on the wrapper so its border colour can animate on focus.
  fieldWrap: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 3,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
  },
  textField: {
    ...typography.body,
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
    color: colors.ink,
    padding: 0, // strip RN's default vertical padding so text sits dead-centre
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22, // circle
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.38, // clearly reads as inactive when there's nothing to send
  },
});
