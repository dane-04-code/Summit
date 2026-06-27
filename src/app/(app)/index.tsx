/**
 * Agent chat screen — Agent Messenger.
 * Header + hybrid message thread + composer, per the Agent Messenger design.
 * Networking is stubbed (see ponytail comments); the opening thread is seeded
 * from `SEED_THREAD` and live sends stream a placeholder reply.
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
import { SEED_THREAD, RECENT_CHATS, ACTIVE_CHAT_ID, ACCOUNT } from '@/ui/chat/seed';
import type { Message, AgentBlock, RunState } from '@/ui/chat/types';

// ---------------------------------------------------------------------------
// Stub streaming data
// ponytail: replace stub stream with real hermes.sendMessage()
// ---------------------------------------------------------------------------

const AGENT_NAME = 'Hermes';
const RUNNING_HINT = 'searching the web…';

const STUB_WORDS =
  'Got it. Let me check — everything looks good on my end. Feel free to ask anything else.'.split(
    ' ',
  );
const STREAM_INTERVAL_MS = Math.round(1200 / STUB_WORDS.length);

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
}: {
  message: Message;
  onApprove: (id: string) => void;
  onStop: (id: string) => void;
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
      <AgentMessage blocks={message.blocks} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// AgentScreen
// ---------------------------------------------------------------------------

export default function AgentScreen() {
  const [messages, setMessages] = useState<Message[]>(SEED_THREAD);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<RunState>('running');
  // True only while a live reply is streaming — gates the composer. Kept
  // separate from `status` so the seeded "running" state still accepts input.
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const flashListRef = useRef<FlashListRef<Message>>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Clean up any live stream interval on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current !== null) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

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
    if (streamIntervalRef.current !== null) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    Haptics.selectionAsync().catch(() => {});
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

  const handleSelectChat = useCallback((_id: string) => {
    // ponytail: load the selected conversation's history when sessions land
    setSidebarOpen(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSidebarOpen(false);
    router.push('/(app)/settings');
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
      prev.map((m) =>
        m.id === id ? agentText(`${id}-result`, 'Stopped. Nothing was run.') : m,
      ),
    );
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');

    const userMsg: Message = { id: genId(), role: 'user', text };
    const agentId = genId();
    setMessages((prev) => [...prev, userMsg, agentText(agentId, '')]);
    setStreaming(true);
    setStatus('running');

    // ponytail: replace stub stream with real hermes.sendMessage()
    let wordIndex = 0;
    if (streamIntervalRef.current !== null) clearInterval(streamIntervalRef.current);

    streamIntervalRef.current = setInterval(() => {
      wordIndex += 1;
      const streamed = STUB_WORDS.slice(0, wordIndex).join(' ');

      setMessages((prev) =>
        prev.map((m) => (m.id === agentId ? agentText(agentId, streamed) : m)),
      );

      if (wordIndex >= STUB_WORDS.length) {
        if (streamIntervalRef.current !== null) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
        }
        setStreaming(false);
        setStatus('idle');
      }
    }, STREAM_INTERVAL_MS);
  }, [input, streaming]);

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
              <MessageRow message={item} onApprove={handleApprove} onStop={handleStop} />
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
        groups={RECENT_CHATS}
        activeId={ACTIVE_CHAT_ID}
        account={ACCOUNT}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onOpenSettings={handleOpenSettings}
      />
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
