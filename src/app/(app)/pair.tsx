import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAgents } from '@/agents/AgentProvider';
import { RelayClient } from '@/agents/relay/client';
import { RELAY_WS_URL } from '@/config';
import { colors, space, radius, typography, screenPadding } from '@/theme';

export default function PairScreen() {
  const { addAgent } = useAgents();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<RelayClient | null>(null);

  const canSubmit = code.trim().length === 6 && !loading;

  async function handlePair() {
    setError(null);
    setLoading(true);
    const trimmed = code.trim();
    try {
      const wsUrl = `${RELAY_WS_URL}?code=${encodeURIComponent(trimmed)}`;
      const client = new RelayClient(wsUrl);
      clientRef.current = client;
      const info = await client.pair(trimmed);
      client.disconnect();
      clientRef.current = null;

      await addAgent(
        {
          name: info.agentName || 'Hermes',
          framework: 'hermes',
          transport: 'relay',
          baseUrl: null,
          capabilities: null,
        },
        trimmed,
      );
      router.replace('/(app)');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Pairing failed — check the code and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.top}>
            <Text style={styles.title}>Enter pairing code</Text>
            <Text style={styles.subtitle}>
              Run the connector next to your agent and enter the 6-digit code it prints.
            </Text>
          </View>

          <TextInput
            style={[styles.codeInput, error ? styles.codeInputError : null]}
            placeholder="000000"
            placeholderTextColor={colors.faint}
            value={code}
            onChangeText={(t) => {
              setError(null);
              setCode(t.replace(/\D/g, '').slice(0, 6));
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={() => canSubmit && handlePair()}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handlePair}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.btnText}>Connect</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace('/(app)/connect')} hitSlop={8}>
            <Text style={styles.link}>Advanced: use host + API key instead</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: screenPadding,
    justifyContent: 'center',
    gap: space.lg,
    paddingBottom: space.xl,
  },
  top: { gap: space.sm },
  title: { ...typography.title, color: colors.ink, letterSpacing: -0.5 },
  subtitle: { ...typography.body, color: colors.muted },
  codeInput: {
    ...typography.title,
    color: colors.ink,
    fontSize: 36,
    letterSpacing: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    textAlign: 'center',
  },
  codeInputError: { borderColor: colors.error },
  error: { ...typography.caption, color: colors.error },
  btn: {
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { ...typography.body, fontWeight: '600', color: colors.bg },
  link: { ...typography.caption, color: colors.muted, textAlign: 'center' },
});
