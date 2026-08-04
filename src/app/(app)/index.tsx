/**
 * Agent chat screen — Summit.
 * Header + hybrid message thread + composer, per the Summit design.
 * The thread is restored from the active agent's most recent saved session and
 * live sends stream through the agent adapter. (The sidebar still reads seed
 * data — wired in the history slice.)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';

import * as Clipboard from 'expo-clipboard';

import { colors, space, radius, typography, screenPadding } from '@/theme';
import { Header } from '@/ui/chat/Header';
import { AgentMessage } from '@/ui/chat/AgentMessage';
import { ChatComposer, type ChatComposerHandle } from '@/ui/chat/ChatComposer';
import { ApprovalCard } from '@/ui/chat/ApprovalCard';
import { Sidebar } from '@/ui/chat/Sidebar';
import { MdReader } from '@/ui/chat/MdReader';
import { SlashCommandMenu } from '@/ui/chat/SlashCommandMenu';
import { ModelPickerSheet, shortModelName } from '@/ui/chat/ModelPickerSheet';
import { useModelPicker } from '@/ui/chat/useModelPicker';
import { matchCommands, type SlashCommand } from '@/ui/chat/slashCommands';
import { CopiedToast } from '@/ui/chat/CopiedToast';
import { EventDisclosure } from '@/ui/chat/EventDisclosure';
import { useAuth } from '@/context/AuthContext';
import { accountName, accountInitial } from '@/lib/account';
import { messageToText } from '@/ui/chat/types';
import { approvalResolutions, type ApprovalCommand } from '@/ui/chat/approvalPrompt';
import { renameSession } from '@/ui/chat/sessionActions';
import { buildApprovalMessage, resolveApproval } from '@/ui/chat/approval';
import type { ApprovalDecision } from '@/ui/chat/approval';
import type { Message, RunState, MarkdownFile, ChatGroup } from '@/ui/chat/types';
import { useAgents } from '@/agents/AgentProvider';
import { captureError } from '@/lib/errorReporting';
import { defaultCapabilitiesFor, frameworkLabel } from '@/agents/frameworks';
import type { ConnectionState } from '@/agents/adapters/types';
import { initialTurn, reduceTurn, turnToBlocks, settleBlocks, settleErrorBlocks, shouldFlush } from '@/ui/chat/streamReducer';
import { recoverPendingReplies, recoveredMessageId, type RecoveredReply } from '@/ui/chat/recoverReplies';
import { pendingPush } from '@/ui/chat/pushRoute';
import type { ChatSession } from '@/agents/types';
import { PLUGIN_NUDGE_ENABLED } from '@/config';
import { PluginNudgeBanner, PLUGIN_INSTALL_PROMPT } from '@/ui/chat/PluginNudgeBanner';
import { isPluginNudgeDismissed, dismissPluginNudge } from '@/ui/chat/pluginNudgePreference';

// ---------------------------------------------------------------------------
// Live streaming helpers
// ---------------------------------------------------------------------------

const AGENT_NAME = 'Hermes';

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

/** Human-sized elapsed time for the live, operational working indicator. */
function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

// ---------------------------------------------------------------------------
// MessageRow
// ---------------------------------------------------------------------------

function MessageRow({
  message,
  onApprove,
  onStop,
  onApprovalCommand,
  resolvedApprovalCommand,
  onOpenFile,
  onCopy,
}: {
  message: Message;
  onApprove: (id: string) => void;
  onStop: (id: string) => void;
  onApprovalCommand: (command: ApprovalCommand) => void;
  resolvedApprovalCommand?: ApprovalCommand;
  onOpenFile: (file: MarkdownFile) => void;
  onCopy: (message: Message) => void;
}) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <Pressable onLongPress={() => onCopy(message)} style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </Pressable>
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
    <Pressable onLongPress={() => onCopy(message)} style={styles.block}>
      <AgentMessage
        blocks={message.blocks}
        onOpenFile={onOpenFile}
        onApprovalCommand={onApprovalCommand}
        resolvedApprovalCommand={resolvedApprovalCommand}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// AgentScreen
// ---------------------------------------------------------------------------

export default function AgentScreen() {
  const { sessionId: notificationSessionId, n: notificationTap } = useLocalSearchParams<{
    sessionId?: string;
    n?: string;
  }>();
  const { agents, activeAgent, adapterFor, repo, selectAgent } = useAgents();
  const { user } = useAuth();
  const name = accountName(user);
  const account = { name, initial: accountInitial(name) };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<RunState>('idle');
  // True only while a live reply is streaming — gates the composer.
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openFile, setOpenFile] = useState<MarkdownFile | null>(null);
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [copiedAt, setCopiedAt] = useState(0);
  const [adapterConnectionState, setConnectionState] = useState<ConnectionState>('unknown');
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeToolLabel, setActiveToolLabel] = useState<string | null>(null);
  const [completionReceipt, setCompletionReceipt] = useState<RecoveredReply | null>(null);
  const [showPluginNudge, setShowPluginNudge] = useState(false);
  // The command menu, opened by tapping the composer's + rather than typing a
  // slash. Same menu, same commands — just reachable without knowing to type.
  const [commandsOpen, setCommandsOpen] = useState(false);
  const connectionState: ConnectionState = activeAgent ? adapterConnectionState : 'unknown';
  const resolvedApprovalCommands = useMemo(() => approvalResolutions(messages), [messages]);

  const flashListRef = useRef<FlashListRef<Message>>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const sessionRef = useRef<ChatSession | null>(null);
  const cancelledRef = useRef(false);
  // Set by the stop button; the stream loop checks it and ends the turn early.
  const stopRef = useRef(false);
  const syncingAgentRef = useRef<string | null>(null);
  // Which agent the visible thread belongs to. A turn started before an agent
  // switch keeps persisting to its own session, but must stop painting into the
  // thread the user is now looking at.
  const consumedPushSessionRef = useRef<string | null>(null);
  const activeAgentIdRef = useRef<string | null>(activeAgent?.id ?? null);
  useEffect(() => {
    activeAgentIdRef.current = activeAgent?.id ?? null;
  }, [activeAgent?.id]);
  const insets = useSafeAreaInsets();
  const updateInput = useCallback((text: string) => {
    setInput(text);
    // Typing (or picking a command) answers the question the menu was asking.
    setCommandsOpen(false);
  }, []);

  // Guard against setState after the screen unmounts mid-stream.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // This is intentionally operational status, not hidden model reasoning:
  // it tells the user that a run is alive and, when Hermes reports it, which
  // tool is currently active.
  useEffect(() => {
    if (!streaming || !runStartedAt) return undefined;
    const tick = () => setElapsedMs(Date.now() - runStartedAt);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [streaming, runStartedAt]);

  useEffect(() => {
    if (!activeAgent) return;
    const adapter = adapterFor(activeAgent);
    return adapter.subscribeConnectionState(setConnectionState);
  }, [activeAgent, adapterFor]);

  // Nudge connector users toward the native plugin. Gated on PLUGIN_NUDGE_ENABLED
  // until the plugin has a real tagged release — see src/config.ts.
  useEffect(() => {
    let cancelled = false;
    if (!PLUGIN_NUDGE_ENABLED || !activeAgent || activeAgent.transport !== 'relay' || activeAgent.connectionVia === 'plugin') {
      setShowPluginNudge(false);
      return undefined;
    }
    void isPluginNudgeDismissed(repo, activeAgent.id).then((dismissed) => {
      if (!cancelled) setShowPluginNudge(!dismissed);
    });
    return () => {
      cancelled = true;
    };
  }, [activeAgent, repo]);

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

  // Telegram-style delivery: on every authenticated reconnect, pull replies
  // the connector finished while iOS had the app suspended, persist them, and
  // only then acknowledge the connector's outbox.
  useEffect(() => {
    if (!activeAgent || connectionState !== 'connected' || syncingAgentRef.current === activeAgent.id) return;
    const adapter = adapterFor(activeAgent);
    if (!adapter.syncPendingReplies) return;
    let cancelled = false;
    syncingAgentRef.current = activeAgent.id;
    void recoverPendingReplies(repo, adapter, activeAgent.id)
      .then(async (recovered) => {
        if (cancelled || recovered.length === 0) return;
        const changedSessionIds = [...new Set(recovered.map((reply) => reply.sessionId))];
        setCompletionReceipt(recovered[recovered.length - 1]);
        const current = sessionRef.current;
        if (current && changedSessionIds.includes(current.id)) {
          await loadSession(current);
        }
        if (!cancelled) await loadSessionSummaries();
      })
      .catch((e) => captureError(e, { where: 'reply_sync', transport: 'relay' }))
      .finally(() => {
        if (syncingAgentRef.current === activeAgent.id) syncingAgentRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [activeAgent, adapterFor, connectionState, loadSession, loadSessionSummaries, repo]);

  // A host can finish scheduled work while this foreground socket is idle.
  // The relay carries only a content-free nudge; the durable reply still comes
  // from the normal outbox sync before it is ever displayed.
  useEffect(() => {
    if (!activeAgent) return;
    const adapter = adapterFor(activeAgent);
    if (!adapter.subscribeProactiveDelivery) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const sync = () => {
      if (syncingAgentRef.current === activeAgent.id) return;
      syncingAgentRef.current = activeAgent.id;
      void recoverPendingReplies(repo, adapter, activeAgent.id)
        .then(async (recovered) => {
          if (cancelled || recovered.length === 0) return;
          const changedSessionIds = [...new Set(recovered.map((reply) => reply.sessionId))];
          setCompletionReceipt(recovered[recovered.length - 1]);
          const current = sessionRef.current;
          if (current && changedSessionIds.includes(current.id)) await loadSession(current);
          if (!cancelled) await loadSessionSummaries();
        })
        .catch((e) => captureError(e, { where: 'proactive_reply_sync', transport: 'relay' }))
        .finally(() => {
          if (syncingAgentRef.current === activeAgent.id) syncingAgentRef.current = null;
        });
    };
    void adapter.subscribeProactiveDelivery((sync)).then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    }).catch((e) => captureError(e, { where: 'proactive_reply_subscribe', transport: 'relay' }));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeAgent, adapterFor, loadSession, loadSessionSummaries, repo]);

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
      // A notification tap is honoured once — see `pushRoute.ts`.
      const pending = pendingPush(
        { sessionId: notificationSessionId, n: notificationTap },
        consumedPushSessionRef.current,
      );
      const requestedSession = pending ? await repo.getSession(pending.sessionId) : null;
      // A push carries only an opaque local session id. Resolve it locally and
      // select its owner instead of treating it as a server-side identity.
      // (Left unconsumed: the next pass loads it under the right agent.)
      if (requestedSession && requestedSession.agentId !== activeAgent.id) {
        await selectAgent(requestedSession.agentId);
        return;
      }
      if (pending) consumedPushSessionRef.current = pending.tap;
      const sessions = await repo.listSessions(activeAgent.id); // newest-first
      const latest = requestedSession ?? sessions[0] ?? null;
      if (cancelled) return;
      await loadSession(latest);
      if (!cancelled) await loadSessionSummaries();
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAgent, notificationSessionId, notificationTap, repo, loadSession, loadSessionSummaries, selectAgent]);

  const statusLabel =
    status === 'running' ? 'working' : status === 'error' ? 'connection error' : 'ready';
  const statusHint = status === 'running'
    ? [activeToolLabel, formatElapsed(elapsedMs)].filter(Boolean).join(' · ')
    : null;
  // Capability-driven UI: features surface only when the agent supports them.
  // Agents paired before capabilities were captured fall back to framework
  // defaults — additive, never subtractive.
  const capabilities = activeAgent
    ? activeAgent.capabilities ?? defaultCapabilitiesFor(activeAgent.framework)
    : null;
  const slashMatches = useMemo(
    () => matchCommands(commandsOpen ? '/' : input, capabilities),
    [commandsOpen, input, capabilities],
  );
  const agentFrameworkLabel = activeAgent ? frameworkLabel(activeAgent.framework) : 'Hermes';
  const sidebarTitle = activeAgent?.name ?? 'Summit';
  const sidebarSubtitle = activeAgent
    ? agentFrameworkLabel
    : 'No agent connected';

  const handleNewChat = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    sessionRef.current = null;
    setActiveSessionId('');
    setMessages([]);
    updateInput('');
    setStreaming(false);
    setStatus('idle');
    setRunStartedAt(null);
    setElapsedMs(0);
    setActiveToolLabel(null);
    setSidebarOpen(false);
  }, [updateInput]);

  const handleMenu = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    Keyboard.dismiss();
    setSidebarOpen(true);
  }, []);

  const handleOpenFile = useCallback((file: MarkdownFile) => {
    Haptics.selectionAsync().catch(() => {});
    setOpenFile(file);
  }, []);

  const handleCopyMessage = useCallback((message: Message) => {
    const text = messageToText(message);
    if (!text) return;
    Clipboard.setStringAsync(text).catch(() => {});
    Haptics.selectionAsync().catch(() => {});
    setCopiedAt(Date.now());
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

  const handleRenameChat = useCallback(
    async (id: string, title: string) => {
      const ok = await renameSession(repo, id, title);
      if (ok) await loadSessionSummaries();
    },
    [repo, loadSessionSummaries],
  );

  const handleDeleteChat = useCallback(
    async (id: string) => {
      await repo.deleteSession(id);
      if (sessionRef.current?.id === id) {
        sessionRef.current = null;
        setActiveSessionId('');
        setMessages([]);
        setStreaming(false);
        setStatus('idle');
      }
      await loadSessionSummaries();
    },
    [repo, loadSessionSummaries],
  );

  const handleOpenSettings = useCallback(() => {
    setSidebarOpen(false);
    router.push('/(app)/settings');
  }, []);

  const agentOptions = useMemo(
    () =>
      agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        frameworkLabel: frameworkLabel(agent.framework),
        avatarId: agent.avatarId ?? null,
        accentColor: agent.accentColor ?? null,
      })),
    [agents],
  );

  // Switching is a clean cut: drop the outgoing agent's thread before the
  // incoming one loads, so nothing from agent A is ever on screen under
  // agent B's header. A run already in flight keeps writing to its own session.
  const handleSelectAgent = useCallback(
    async (id: string) => {
      setSidebarOpen(false);
      if (id === activeAgentIdRef.current) return;
      Haptics.selectionAsync().catch(() => {});
      sessionRef.current = null;
      setActiveSessionId('');
      setMessages([]);
      setChatGroups([]);
      setStatus('idle');
      setActiveToolLabel(null);
      setCompletionReceipt(null);
      await selectAgent(id);
    },
    [selectAgent],
  );

  const handleAddAgent = useCallback(() => {
    setSidebarOpen(false);
    router.push('/(app)/pair' as '/');
  }, []);

  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      Haptics.selectionAsync().catch(() => {});
      if (cmd.scope === 'app') {
        updateInput('');
        if (cmd.action === 'settings') handleOpenSettings();
        else handleNewChat(); // 'new' and 'clear' both start a fresh thread in v1
        return;
      }
      updateInput(cmd.send);
      composerRef.current?.focus();
    },
    [handleOpenSettings, handleNewChat, updateInput],
  );

  const handleToggleCommands = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setCommandsOpen((open) => !open);
  }, []);

  const handleOpenCron = useCallback(() => {
    setSidebarOpen(false);
    router.push('/(app)/cron');
  }, []);

  const handleOpenAgentProfile = useCallback(() => {
    router.push('/(app)/agent-profile' as '/');
  }, []);

  // Resolve an approval card through the adapter's Runs API, then swap the
  // card for the outcome copy. On failure the card stays so the user can retry.
  const resolveDecision = useCallback(
    async (id: string, decision: ApprovalDecision) => {
      const card = messages.find((m) => m.id === id);
      if (!card || card.role !== 'action' || !activeAgent) return;
      const outcome = await resolveApproval(adapterFor(activeAgent), card, decision);
      if (!outcome.ok) {
        captureError(outcome.error, { where: 'run_approval', framework: activeAgent.framework });
      }
      if (cancelledRef.current) return;
      setMessages((prev) =>
        outcome.ok
          ? prev.map((m) => (m.id === id ? outcome.message : m))
          : // Keep the card for retry; append (or re-append) the failure note.
            [...prev.filter((m) => m.id !== outcome.message.id), outcome.message],
      );
    },
    [messages, activeAgent, adapterFor],
  );

  const handleApprove = useCallback(
    (id: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void resolveDecision(id, 'approve');
    },
    [resolveDecision],
  );

  const handleStop = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      void resolveDecision(id, 'stop');
    },
    [resolveDecision],
  );

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

  // The picker talks to the host about the session the next message will use,
  // so a session-scoped switch lands on the thread the user is looking at
  // rather than on one that gets minted afterwards.
  const modelPicker = useModelPicker(
    activeAgent ? adapterFor(activeAgent) : null,
    useCallback(async () => (await ensureSession()).id, [ensureSession]),
    connectionState,
  );

  const composerModel = useMemo(
    () =>
      modelPicker.available
        ? {
            label: modelPicker.currentModel
              ? shortModelName(modelPicker.currentModel)
              : 'Model',
            providerSlug: modelPicker.currentProvider ?? '',
            onPress: modelPicker.openPicker,
          }
        : null,
    [
      modelPicker.available,
      modelPicker.currentModel,
      modelPicker.currentProvider,
      modelPicker.openPicker,
    ],
  );

  const handleStopStream = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    stopRef.current = true;
  }, []);

  const handleRetryConnection = useCallback(() => {
    if (!activeAgent) return;
    Haptics.selectionAsync().catch(() => {});
    void adapterFor(activeAgent).retryConnection().catch(() => {
      setConnectionState('disconnected');
    });
  }, [activeAgent, adapterFor]);

  const submitText = useCallback(async (rawText: string, clearComposer: boolean) => {
    const text = rawText.trim();
    if (!text || streaming || !activeAgent) return;
    stopRef.current = false;
    if (clearComposer) updateInput('');

    // A turn belongs to the agent that started it. If the user switches agents
    // mid-run, the reply still streams and still persists to its own session —
    // it just stops touching the thread, status, and session list on screen.
    const turnAgentId = activeAgent.id;
    const onScreen = () => activeAgentIdRef.current === turnAgentId;
    const setThread: typeof setMessages = (updater) => {
      if (onScreen()) setMessages(updater);
    };
    const setThreadStatus = (next: RunState) => {
      if (onScreen()) setStatus(next);
    };

    const session = await ensureSession();
    const now = Date.now();
    const userMsg: Message = { id: genId(), role: 'user', text };
    await repo.appendMessage({ id: userMsg.id, sessionId: session.id, message: userMsg, createdAt: now });

    const agentId = genId();
    setThread((prev) => [
      ...prev,
      userMsg,
      { id: agentId, role: 'agent', blocks: [{ kind: 'markdown', source: '' }] },
    ]);
    setStreaming(true);
    setStatus('running');
    setRunStartedAt(Date.now());
    setElapsedMs(0);
    setActiveToolLabel(null);
    // One deliberate scroll to the send; while streaming, FlashList's
    // maintainVisibleContentPosition follows the bottom only when the reader
    // is already there — scrolling up to read is never fought.
    setTimeout(() => flashListRef.current?.scrollToEnd({ animated: true }), 50);

    let turn = initialTurn;
    let lastFlushAt = 0;
    let settledEventId: string | undefined;
    let detached = false;
    const acknowledgeSettledReply = async () => {
      if (!settledEventId) return;
      try {
        await adapterFor(activeAgent).acknowledgeReplies?.([settledEventId]);
      } catch (e) {
        // SQLite already owns the message. A lost ack is safe: stable event
        // IDs make the next replay idempotent.
        captureError(e, { where: 'reply_ack', transport: 'relay' });
      }
    };
    try {
      const adapter = adapterFor(activeAgent);
      const stream = adapter.sendMessage(text, {
        sessionId: session.id,
        sessionKey: session.remoteSessionKey ?? undefined,
      });
      for await (const event of stream) {
        if (stopRef.current) break;
        if (onScreen()) {
          if (event.type === 'tool') setActiveToolLabel(event.label);
          if (event.type === 'delta') setActiveToolLabel(null);
          if (event.type === 'approval') setActiveToolLabel('Waiting for your approval');
        }
        if (event.type === 'done' || event.type === 'error') settledEventId = event.eventId;
        if (event.type === 'detached') detached = true;
        turn = reduceTurn(turn, event);
        if (cancelledRef.current) return;
        const now = Date.now();
        if (shouldFlush(lastFlushAt, now, turn.done)) {
          lastFlushAt = now;
          setThread((prev) =>
            prev.map((m) =>
              m.id === agentId ? { id: agentId, role: 'agent', blocks: turnToBlocks(turn) } : m,
            ),
          );
        }
        if (turn.done) break;
      }
    } catch (e) {
      captureError(e, { where: 'chat_stream', framework: activeAgent.framework });
      if (onScreen()) setConnectionState('disconnected');
      const reason = e instanceof Error && e.message.trim()
        ? e.message
        : typeof e === 'string' && e.trim()
          ? e
          : 'Agent disconnected.';
      turn = { ...turn, status: 'error', error: reason, done: true };
    }

    if (cancelledRef.current) return;
    setStreaming(false);
    setRunStartedAt(null);
    if (onScreen()) setActiveToolLabel(null);

    // The connector still owns this turn. Remove the temporary stream row;
    // reconnect sync will insert the settled reply with its durable event ID.
    if (detached) {
      setThreadStatus('idle');
      setThread((prev) => prev.filter((m) => m.id !== agentId));
      return;
    }

    // A reply stopped before any text arrived just disappears — nothing to keep.
    if (stopRef.current && turn.text.trim() === '') {
      setThreadStatus('idle');
      setThread((prev) => prev.filter((m) => m.id !== agentId));
      return;
    }

    if (turn.status === 'error') {
      setThreadStatus('error');
      const finalAgentId = settledEventId ? recoveredMessageId(settledEventId) : agentId;
      const errorMsg: Message = {
        id: finalAgentId,
        role: 'agent',
        blocks: settleErrorBlocks(turn.text, turn.error ?? 'Something went wrong.'),
      };
      setThread((prev) =>
        prev.map((m) =>
          m.id === agentId ? errorMsg : m,
        ),
      );
      await repo.appendMessage({ id: errorMsg.id, sessionId: session.id, message: errorMsg, createdAt: Date.now() });
      const title = session.title ?? text.slice(0, 40);
      const updated: ChatSession = { ...session, title, updatedAt: Date.now() };
      await repo.upsertSession(updated);
      if (onScreen()) {
        sessionRef.current = updated;
        setActiveSessionId(updated.id);
      }
      await acknowledgeSettledReply();
      if (onScreen()) await loadSessionSummaries();
      return;
    }

    setThreadStatus('idle');
    const finalAgentId = settledEventId ? recoveredMessageId(settledEventId) : agentId;
    const settled: Message = { id: finalAgentId, role: 'agent', blocks: settleBlocks(turn.text) };
    // Snap from streaming markdown to the settled form (file card for pasted .md content, etc.)
    setThread((prev) => prev.map((m) => (m.id === agentId ? settled : m)));
    // An approval gate holds the run open without `done` — surface the card so
    // the user can act. Pending state is ephemeral: never persisted to the repo.
    const pending = turn.pendingApproval;
    if (pending) {
      setThread((prev) => [...prev, buildApprovalMessage(genId(), pending)]);
    }
    await repo.appendMessage({ id: settled.id, sessionId: session.id, message: settled, createdAt: Date.now() });
    const title = session.title ?? text.slice(0, 40);
    const updated: ChatSession = { ...session, title, updatedAt: Date.now() };
    await repo.upsertSession(updated);
    if (onScreen()) {
      sessionRef.current = updated;
      setActiveSessionId(updated.id);
    }
    await acknowledgeSettledReply();
    if (onScreen()) await loadSessionSummaries();
  }, [streaming, activeAgent, adapterFor, repo, ensureSession, loadSessionSummaries, updateInput]);

  const handleSend = useCallback(() => {
    void submitText(input, true);
  }, [input, submitText]);

  const handleApprovalCommand = useCallback(
    (command: ApprovalCommand) => {
      void submitText(command, false);
    },
    [submitText],
  );

  const handleInstallPlugin = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    updateInput(PLUGIN_INSTALL_PROMPT);
    composerRef.current?.focus();
    setShowPluginNudge(false);
    if (activeAgent) void dismissPluginNudge(repo, activeAgent.id);
  }, [activeAgent, repo, updateInput]);

  const handleDismissPluginNudge = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setShowPluginNudge(false);
    if (activeAgent) void dismissPluginNudge(repo, activeAgent.id);
  }, [activeAgent, repo]);

  const handleOpenRecoveredConversation = useCallback(() => {
    if (!completionReceipt) return;
    void (async () => {
      const session = await repo.getSession(completionReceipt.sessionId);
      if (session) await loadSession(session);
      setCompletionReceipt(null);
    })();
  }, [completionReceipt, loadSession, repo]);

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
          hint={statusHint}
          connectionState={connectionState}
          frameworkLabel={agentFrameworkLabel}
          onRetryConnection={handleRetryConnection}
          onOpenProfile={handleOpenAgentProfile}
          onMenu={handleMenu}
          onNewChat={handleNewChat}
        />

        {completionReceipt && (
          <EventDisclosure
            receipt={completionReceipt}
            onOpen={handleOpenRecoveredConversation}
            onDismiss={() => setCompletionReceipt(null)}
          />
        )}

        {showPluginNudge && (
          <PluginNudgeBanner onInstall={handleInstallPlugin} onDismiss={handleDismissPluginNudge} />
        )}

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
                onApprovalCommand={handleApprovalCommand}
                resolvedApprovalCommand={resolvedApprovalCommands.get(item.id)}
                onOpenFile={handleOpenFile}
                onCopy={handleCopyMessage}
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

          <SlashCommandMenu commands={slashMatches} onSelect={handleSlashSelect} />

          {/* The host's own words about a switch it just made. Kept because a
              successful switch can still carry a warning (a cleared context
              pin, a smaller window) the chip alone would hide. */}
          {modelPicker.notice ? (
            <Pressable
              onPress={modelPicker.dismissNotice}
              style={styles.modelNotice}
              accessibilityRole="button"
              accessibilityLabel={`${modelPicker.notice}. Dismiss.`}
            >
              <Text style={styles.modelNoticeText}>{modelPicker.notice}</Text>
            </Pressable>
          ) : null}

          <ChatComposer
            ref={composerRef}
            value={input}
            onChangeText={updateInput}
            onSend={handleSend}
            onStop={handleStopStream}
            streaming={streaming}
            bottomInset={insets.bottom}
            model={composerModel}
            onCommands={handleToggleCommands}
            commandsOpen={commandsOpen}
          />
        </KeyboardAvoidingView>

        <ModelPickerSheet picker={modelPicker} />

        <CopiedToast shownAt={copiedAt} />
      </SafeAreaView>

      <Sidebar
        visible={sidebarOpen}
        groups={chatGroups}
        activeId={activeSessionId}
        title={sidebarTitle}
        subtitle={sidebarSubtitle}
        agents={agentOptions}
        activeAgentId={activeAgent?.id ?? null}
        onSelectAgent={handleSelectAgent}
        onAddAgent={handleAddAgent}
        connectionState={connectionState}
        onRetryConnection={handleRetryConnection}
        account={account}
        showCron={capabilities?.hasJobs ?? false}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
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
  modelNotice: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  modelNoticeText: {
    ...typography.caption,
    color: colors.ink2,
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

});
