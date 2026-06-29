import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAgents } from '@/agents/AgentProvider';
import { RelayClient } from '@/agents/relay/client';
import { RELAY_WS_URL } from '@/config';
import { colors, space, radius, typography } from '@/theme';

export default function SettingsScreen() {
  const { activeAgent, repairAgent } = useAgents();
  const [repairing, setRepairing] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const clientRef = useRef<RelayClient | null>(null);

  async function handleRepair() {
    if (!activeAgent) return;
    setError(null);
    setLoading(true);
    const trimmed = code.trim();
    try {
      const wsUrl = `${RELAY_WS_URL}?code=${encodeURIComponent(trimmed)}`;
      const client = new RelayClient(wsUrl);
      clientRef.current = client;
      await client.pair(trimmed);
      client.disconnect();
      clientRef.current = null;
      await repairAgent(activeAgent.id, trimmed);
      setDone(true);
      setTimeout(() => router.back(), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pairing failed — check the code and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={22} color={colors.muted} strokeWidth={1.9} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Agent</Text>

          {!repairing ? (
            <Pressable
              style={styles.row}
              onPress={() => { setRepairing(true); setCode(''); setError(null); setDone(false); }}
            >
              <Text style={styles.rowLabel}>Re-pair agent</Text>
              <ChevronRight size={18} color={colors.muted} strokeWidth={1.5} />
            </Pressable>
          ) : (
            <View style={styles.repairCard}>
              <Text style={styles.repairHint}>
                Ask your agent for a fresh 6-digit code, then enter it below.
              </Text>
              <TextInput
                style={[styles.codeInput, error ? styles.codeInputError : null]}
                placeholder="••••••"
                placeholderTextColor={colors.line}
                value={code}
                onChangeText={(t) => { setError(null); setCode(t.replace(/\D/g, '').slice(0, 6)); }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={() => code.trim().length === 6 && !loading && handleRepair()}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                style={[styles.pairBtn, (code.trim().length < 6 || loading) && styles.btnDisabled]}
                onPress={handleRepair}
                disabled={code.trim().length < 6 || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.bg} />
                ) : done ? (
                  <Text style={styles.pairBtnText}>Paired</Text>
                ) : (
                  <Text style={styles.pairBtnText}>Pair agent</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setRepairing(false)} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
  },

  body: {
    padding: space.lg,
    gap: space.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    paddingHorizontal: space.md + 2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowLabel: {
    ...typography.body,
    color: colors.ink,
  },

  repairCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md + 2,
    gap: space.md,
  },
  repairHint: {
    ...typography.small,
    color: colors.muted,
    lineHeight: 20,
  },
  codeInput: {
    height: 58,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    textAlign: 'center',
    fontFamily: 'Menlo',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 10,
    color: colors.ink,
  },
  codeInputError: { borderColor: colors.error },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  pairBtn: {
    height: 50,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  pairBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bg,
  },
  cancel: {
    ...typography.small,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: space.xs,
  },
});
