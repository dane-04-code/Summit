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
import { ArrowUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { colors, space, radius, typography, screenPadding } from '@/theme';
import { usePressAnim } from '@/ui/usePressAnim';
import { Header } from '@/ui/chat/Header';
import { AgentMessage } from '@/ui/chat/AgentMessage';
import { ApprovalCard } from '@/ui/chat/ApprovalCard';
import { Sidebar } from '@/ui/chat/Sidebar';
import { MdReader } from '@/ui/chat/MdReader';
import { useAuth } from '@/context/AuthContext';
import type { Message, AgentBlock, RunState, MarkdownFile } from '@/ui/chat/types';
import { useAgents } from '@/agents/AgentProvider';
import { initialTurn, reduceTurn, turnToBlocks } from '@/ui/chat/streamReducer';
import type { ChatSession } from '@/agents/types';

// ---------------------------------------------------------------------------
// Live streaming helpers
// ---------------------------------------------------------------------------

const AGENT_NAME = 'Hermes';
const RUNNING_HINT = 'working…';

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Build an agent message whose single text block holds `text`. */
function agentText(id: string, text: string): Message {
  const blocks: AgentBlock[] = [{ kind: 'text', spans: [{ text }] }];
  return { id, role: 'agent', blocks };
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

  const flashListRef = useRef<FlashListRef<Message>>(null);
  const sessionRef = useRef<ChatSession | null>(null);
  const cancelledRef = useRef(false);
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

  // Restore the most recent thread for the active agent (docs/AGENTS.md §6).
  useEffect(() => {
    if (!activeAgent) return;
    let cancelled = false;
    (async () => {
      const sessions = await repo.listSessions(activeAgent.id); // newest-first
      const latest = sessions[0] ?? null;
      if (!latest || cancelled) return;
      const stored = await repo.listMessages(latest.id); // oldest-first
      if (cancelled) return;
      sessionRef.current = latest;
      setMessages(stored.map((s) => s.message));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAgent, repo]);

  // Scroll to newest content whenever the thread changes (including mid-stream)
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      flashListRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages]);

  const statusLabel =
    status === 'running' ? 'running' : status === 'error' ? 'connection error' : 'ready';

  const handleNewChat = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    sessionRef.current = null;
    setMessages([]);
    setInput('');
    setStreaming(false);
    setStatus('idle');
    setSidebarOpen(false);
  }, []);

  const handleMenu = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setSidebarOpen(true);
  }, []);

  const handleOpenFile = useCallback((file: MarkdownFile) => {
    Haptics.selectionAsync().catch(() => {});
    setOpenFile(file);
  }, []);

  const handleSelectChat = useCallback((_id: string) => {
    // ponytail: load the selected conversation's history when the history slice lands
    setSidebarOpen(false);
  }, []);

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
    return session;
  }, [activeAgent, repo]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !activeAgent) return;
    setInput('');

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

    let turn = initialTurn;
    try {
      const stream = adapterFor(activeAgent).sendMessage(text, {
        sessionId: session.id,
        sessionKey: session.remoteSessionKey ?? undefined,
      });
      for await (const event of stream) {
        turn = reduceTurn(turn, event);
        if (cancelledRef.current) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentId ? { id: agentId, role: 'agent', blocks: turnToBlocks(turn) } : m,
          ),
        );
        if (turn.done) break;
      }
    } catch {
      turn = { ...turn, status: 'error', error: 'The connection to the agent dropped.', done: true };
    }

    if (cancelledRef.current) return;
    setStreaming(false);

    if (turn.status === 'error') {
      setStatus('error');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentId
            ? {
                id: agentId,
                role: 'agent',
                blocks: [
                  { kind: 'text', spans: [{ text: turn.error ?? 'Something went wrong.' }], tone: 'muted' },
                ],
              }
            : m,
        ),
      );
      return;
    }

    setStatus('idle');
    const settled: Message = { id: agentId, role: 'agent', blocks: turnToBlocks(turn) };
    await repo.appendMessage({ id: agentId, sessionId: session.id, message: settled, createdAt: Date.now() });
    const title = session.title ?? text.slice(0, 40);
    const updated: ChatSession = { ...session, title, updatedAt: Date.now() };
    await repo.upsertSession(updated);
    sessionRef.current = updated;
  }, [input, streaming, activeAgent, adapterFor, repo, ensureSession]);

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
          name={AGENT_NAME}
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
            <Animated.View style={[styles.fieldWrap, { borderColor: fieldBorderColor }]}>
              <TextInput
                style={styles.textField}
                value={input}
                onChangeText={setInput}
                placeholder="Message…"
                placeholderTextColor={colors.muted}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                onFocus={() => animateFocus(1)}
                onBlur={() => animateFocus(0)}
                blurOnSubmit={false}
                autoCorrect
                multiline={false}
                accessibilityLabel="Message input"
              />
            </Animated.View>

            <Pressable
              onPress={handleSend}
              onPressIn={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                sendAnim.onPressIn();
              }}
              onPressOut={sendAnim.onPressOut}
              disabled={!canSend}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend }}
            >
              <Animated.View
                style={[styles.sendBtn, sendAnim.animStyle, !canSend && styles.sendBtnDisabled]}
              >
                <ArrowUp size={20} color={colors.onAccentBtn} strokeWidth={2.5} />
              </Animated.View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Sidebar
        visible={sidebarOpen}
        groups={[]}
        activeId=""
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
    alignItems: 'center',
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
    height: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 3,
    backgroundColor: colors.surface,
  },
  textField: {
    ...typography.body,
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
