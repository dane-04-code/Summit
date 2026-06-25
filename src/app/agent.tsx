/**
 * Agent chat screen — Agent Messenger.
 * UI is fully built; networking and markdown rendering are stubbed
 * (see ponytail comments below).
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
import { Stack } from 'expo-router';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { ArrowUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { colors, space, radius, typography, screenPadding } from '../theme';
import { usePressAnim } from '../ui/usePressAnim';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageRole = 'user' | 'agent';

interface Message {
  id: string;
  role: MessageRole;
  text: string;
}

type AgentStatus = 'idle' | 'running' | 'error';

// ---------------------------------------------------------------------------
// Stub streaming data
// ponytail: replace stub stream with real hermes.sendMessage()
// ---------------------------------------------------------------------------

const STUB_WORDS =
  'Got it. Let me check — everything looks good on my end. Feel free to ask anything else.'.split(
    ' ',
  );
const STREAM_INTERVAL_MS = Math.round(1200 / STUB_WORDS.length);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// StatusRow
// ---------------------------------------------------------------------------

interface StatusRowProps {
  status: AgentStatus;
  toolHint: string | null;
}

function StatusRow({ status, toolHint }: StatusRowProps) {
  const dotColor =
    status === 'running' ? colors.accent
    : status === 'error'  ? colors.error
    : colors.muted;

  const baseLabel =
    status === 'running' ? 'thinking…'
    : status === 'error'  ? 'error'
    : 'ready';

  const showHint = status === 'running' && toolHint !== null;

  return (
    <View
      style={styles.statusRow}
      accessibilityRole="none"
      accessibilityLabel={`Agent status: ${baseLabel}${showHint ? ` · ${toolHint}` : ''}`}
    >
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={styles.statusLabel}>
        {baseLabel}
        {showHint ? (
          <Text style={styles.statusHint}>{` · ${toolHint}`}</Text>
        ) : null}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MessageRow
// ---------------------------------------------------------------------------

function MessageRow({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.agentRow}>
      {/* ponytail: swap in <StreamingMarkdown> here later */}
      <Text style={styles.agentText}>{message.text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AgentScreen
// ---------------------------------------------------------------------------

export default function AgentScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AgentStatus>('idle');

  // Demo tool hint — only visible while running
  const toolHint = status === 'running' ? 'searching the web…' : null;

  const flashListRef = useRef<FlashListRef<Message>>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const sendAnim = usePressAnim();

  // Clean up any live stream interval on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current !== null) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  // Scroll to newest content whenever messages change (including mid-stream updates)
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      flashListRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || status === 'running') return;

    // Light haptic on send
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // ignore — haptics not available in simulator
    });

    setInput('');

    // Append user message immediately, then a blank agent placeholder
    const userMsg: Message = { id: genId(), role: 'user', text };
    const agentId = genId();
    const agentMsg: Message = { id: agentId, role: 'agent', text: '' };

    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setStatus('running');

    // ponytail: replace stub stream with real hermes.sendMessage()
    let wordIndex = 0;
    if (streamIntervalRef.current !== null) clearInterval(streamIntervalRef.current);

    streamIntervalRef.current = setInterval(() => {
      wordIndex += 1;
      const streamed = STUB_WORDS.slice(0, wordIndex).join(' ');

      setMessages((prev) =>
        prev.map((m) => (m.id === agentId ? { ...m, text: streamed } : m)),
      );

      if (wordIndex >= STUB_WORDS.length) {
        if (streamIntervalRef.current !== null) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
        }
        setStatus('idle');
      }
    }, STREAM_INTERVAL_MS);
  }, [input, status]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      {/*
       * Top + sides handled by SafeAreaView.
       * Bottom safe area is applied directly to the input bar so it doesn't
       * jump when the keyboard raises (KeyboardAvoidingView owns the bottom).
       */}
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusRow status={status} toolHint={toolHint} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlashList<Message>
            ref={flashListRef}
            data={messages}
            renderItem={({ item }) => <MessageRow message={item} />}
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
            style={[
              styles.inputBar,
              { paddingBottom: Math.max(insets.bottom, space.sm) },
            ]}
          >
            <TextInput
              style={styles.textField}
              value={input}
              onChangeText={setInput}
              placeholder="Message…"
              placeholderTextColor={colors.muted}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              autoCorrect
              multiline={false}
              accessibilityLabel="Message input"
            />

            <Pressable
              onPress={handleSend}
              onPressIn={sendAnim.onPressIn}
              onPressOut={sendAnim.onPressOut}
              disabled={status === 'running'}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: status === 'running' }}
            >
              <Animated.View
                style={[
                  styles.sendBtn,
                  sendAnim.animStyle,
                  status === 'running' && styles.sendBtnDisabled,
                ]}
              >
                <ArrowUp size={20} color={colors.bg} strokeWidth={2.5} />
              </Animated.View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles — no raw hex or magic numbers; everything from theme tokens
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },

  // ── Status row ────────────────────────────────────────────────────────────
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    paddingVertical: space.sm,
    minHeight: 32,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radius.bubble, // fully round dot
    marginRight: space.sm,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.ink,
  },
  statusHint: {
    ...typography.caption,
    color: colors.muted,
  },

  // ── Message list ──────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: screenPadding,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },

  // ── User bubble (right-aligned) ───────────────────────────────────────────
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: space.sm,
  },
  userBubble: {
    backgroundColor: colors.bubble,
    borderRadius: radius.bubble,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    maxWidth: '80%',
  },
  userText: {
    ...typography.body,
    color: colors.ink,
  },

  // ── Agent message (full width, no bubble) ────────────────────────────────
  agentRow: {
    marginVertical: space.sm,
  },
  agentText: {
    ...typography.body,
    color: colors.ink,
  },

  // ── Input bar ─────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  textField: {
    flex: 1,
    ...typography.body,
    color: colors.ink,
    height: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    marginRight: space.sm,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22, // circle
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
