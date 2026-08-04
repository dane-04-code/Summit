import React, { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { RefreshCw, KeyRound, Trash2 } from 'lucide-react-native';

import { useAgents } from '@/agents/AgentProvider';
import { RelayClient } from '@/agents/relay/client';
import { encodeRelayCredential } from '@/agents/relay/credential';
import { formatPairingCode, isPairingCode, normalizePairingCode } from '@/agents/relay/pairingCode';
import { RELAY_WS_URL } from '@/config';
import type { AgentCapabilities } from '@/agents/types';
import { SettingsScreen, SectionLabel, Card, Row } from '@/ui/settings';
import { colors, space, radius, typography } from '@/theme';

const FRAMEWORK_LABEL: Record<string, string> = { hermes: 'Hermes', openclaw: 'OpenClaw' };

function relativeTime(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function capsSummary(caps: AgentCapabilities | null): string {
  if (!caps) return 'Not tested yet';
  const parts: string[] = [];
  if (caps.hasStreaming) parts.push('Streaming');
  if (caps.hasRunApproval) parts.push('Approvals');
  if (caps.hasJobs) parts.push('Jobs');
  return parts.length ? parts.join(' · ') : 'Basic';
}

function availability(supported: boolean | undefined): string {
  return supported ? 'Available' : 'Not available';
}

export default function Connection() {
  const { activeAgent, adapterFor, repairAgent, removeAgent, repo } = useAgents();

  // Retest
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Re-pair (relay)
  const [repairing, setRepairing] = useState(false);
  const [code, setCode] = useState('');
  const [pairLoading, setPairLoading] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const clientRef = useRef<RelayClient | null>(null);

  if (!activeAgent) {
    return (
      <SettingsScreen title="Connection">
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No agent is connected.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(app)/pair' as '/')}>
            <Text style={styles.primaryBtnText}>Pair an agent</Text>
          </Pressable>
        </View>
      </SettingsScreen>
    );
  }

  const agent = activeAgent;

  async function handleRetest() {
    setTestResult(null);
    setTesting(true);
    try {
      const caps = await adapterFor(agent).testConnection();
      await repo.upsertAgent({ ...agent, capabilities: caps, lastUsedAt: Date.now() });
      setTestResult({
        ok: true,
        text: caps.serverVersion ? `Connected · ${caps.serverVersion}` : 'Connected',
      });
    } catch (e) {
      setTestResult({
        ok: false,
        text: e instanceof Error ? e.message : 'Could not reach the agent.',
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleRepair() {
    setPairError(null);
    setPairLoading(true);
    const trimmed = code.trim();
    try {
      const client = new RelayClient(`${RELAY_WS_URL}?code=${encodeURIComponent(trimmed)}`);
      clientRef.current = client;
      const info = await client.pair(trimmed);
      client.disconnect();
      clientRef.current = null;
      await repairAgent(
        agent.id,
        encodeRelayCredential({ code: trimmed, token: info.sessionToken }),
      );
      setPaired(true);
      setTimeout(() => {
        setRepairing(false);
        setPaired(false);
        setCode('');
      }, 1200);
    } catch (e) {
      setPairError(
        e instanceof Error ? e.message : 'Pairing failed — check the code and try again.',
      );
    } finally {
      setPairLoading(false);
    }
  }

  function confirmRemove() {
    Alert.alert(
      'Remove agent',
      `Disconnect ${FRAMEWORK_LABEL[agent.framework] ?? agent.name} and delete its chats from this device? Your agent server is not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void removeAgent(agent.id), // guard redirects to /pair once active is null
        },
      ],
    );
  }

  return (
    <SettingsScreen title="Connection">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.group}>
          <SectionLabel>Details</SectionLabel>
          <Card>
            <Row label="Agent" value={agent.name} />
            <Row label="Framework" value={FRAMEWORK_LABEL[agent.framework] ?? agent.framework} />
            <Row label="Transport" value={agent.transport === 'relay' ? 'Relay' : 'Direct'} />
            {agent.transport === 'direct' && agent.baseUrl ? (
              <Row label="Host" value={agent.baseUrl} />
            ) : null}
            <Row label="Capabilities" value={capsSummary(agent.capabilities)} />
            <Row label="Last active" value={relativeTime(agent.lastUsedAt)} />
          </Card>
        </View>

        <View style={styles.group}>
          <SectionLabel>Agent abilities</SectionLabel>
          <Card>
            <Row label="Streaming replies" value={availability(agent.capabilities?.hasStreaming)} />
            <Row label="Action approvals" value={availability(agent.capabilities?.hasRunApproval)} />
            <Row label="Stop active work" value={availability(agent.capabilities?.hasRunStop)} />
            <Row label="Scheduled jobs" value={availability(agent.capabilities?.hasJobs)} />
            <Row label="Server sessions" value={availability(agent.capabilities?.hasSessions)} />
          </Card>
          <Text style={styles.capabilityHint}>
            This is the feature information Summit received from the agent when it connected. Retest the connection to refresh it.
          </Text>
        </View>

        <View style={styles.group}>
          <SectionLabel>Manage</SectionLabel>
          <Card>
            <Row
              icon={<RefreshCw size={19} color={colors.ink2} strokeWidth={1.75} />}
              label="Retest connection"
              onPress={testing ? undefined : handleRetest}
              right={testing ? <ActivityIndicator color={colors.muted} /> : <View />}
            />
            {agent.transport === 'relay' ? (
              <Row
                icon={<KeyRound size={19} color={colors.ink2} strokeWidth={1.75} />}
                label="Re-pair agent"
                onPress={() => {
                  setRepairing((v) => !v);
                  setCode('');
                  setPairError(null);
                  setPaired(false);
                }}
                right={<View />}
              />
            ) : null}
          </Card>
          {testResult ? (
            <Text style={[styles.result, testResult.ok ? styles.resultOk : styles.resultErr]}>
              {testResult.text}
            </Text>
          ) : null}
        </View>

        {repairing && agent.transport === 'relay' ? (
          <View style={styles.repairCard}>
            <Text style={styles.repairHint}>
              Ask your agent for a fresh pairing code, then enter it below.
            </Text>
            <TextInput
              accessibilityLabel="Pairing code"
              style={[styles.codeInput, pairError ? styles.codeInputError : null]}
              placeholder="XXXX-XXXX"
              placeholderTextColor={colors.line}
              // Grouped for reading, canonical in state — same contract as the
              // pair screen, so both fields accept the code exactly alike.
              value={formatPairingCode(code)}
              onChangeText={(t) => {
                setPairError(null);
                setCode(normalizePairingCode(t));
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              maxLength={9}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => isPairingCode(code) && !pairLoading && handleRepair()}
            />
            {pairError ? <Text style={styles.result}>{pairError}</Text> : null}
            <Pressable
              style={[
                styles.primaryBtn,
                (!isPairingCode(code) || pairLoading) && styles.btnDisabled,
              ]}
              onPress={handleRepair}
              disabled={!isPairingCode(code) || pairLoading}
            >
              {pairLoading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.primaryBtnText}>{paired ? 'Paired' : 'Pair agent'}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.group}>
          <SectionLabel>Danger zone</SectionLabel>
          <Card>
            <Row
              icon={<Trash2 size={19} color={colors.error} strokeWidth={1.75} />}
              label="Remove agent"
              danger
              onPress={confirmRemove}
              right={<View />}
            />
          </Card>
        </View>
      </ScrollView>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 24 },
  group: { gap: 0 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: 24 },
  emptyText: { ...typography.body, color: colors.muted },

  result: { ...typography.caption, marginTop: space.sm, paddingHorizontal: 14 },
  resultOk: { color: colors.accent },
  resultErr: { color: colors.error },
  capabilityHint: { ...typography.caption, color: colors.muted, marginTop: space.sm, paddingHorizontal: 14, lineHeight: 18 },

  repairCard: {
    backgroundColor: colors.drawer,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md + 2,
    gap: space.md,
  },
  repairHint: { ...typography.small, color: colors.muted, lineHeight: 20 },
  codeInput: {
    height: 58,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    textAlign: 'center',
    fontFamily: 'Menlo',
    // Nine glyphs (eight plus the dash) rather than six — see the matching note
    // on the pair screen's field.
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: 6,
    paddingLeft: 6,
    color: colors.ink,
  },
  codeInputError: { borderColor: colors.error },

  primaryBtn: {
    height: 50,
    borderRadius: radius.control,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: colors.bg },
});
