import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ChevronLeft, Copy, Check } from 'lucide-react-native';
import { useAgents } from '@/agents/AgentProvider';
import { RelayClient } from '@/agents/relay/client';
import { RELAY_WS_URL } from '@/config';
import { colors, space, radius, typography } from '@/theme';

const AGENT_PROMPT =
  `You're connecting yourself to the Summit mobile app so I can reach you from my phone. Run this exact command, then tell me the 6-digit code it prints:\n\n    curl -fsSL https://get.summitapp.dev/connect | sh\n\nIt installs a small background connector that bridges your local API to the Summit relay. If anything errors, paste the full output back to me.`;

const CURL_COMMAND = `curl -fsSL https://get.summitapp.dev/connect | sh`;

export default function PairScreen() {
  const { addAgent } = useAgents();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const clientRef = useRef<RelayClient | null>(null);

  const canSubmit = code.trim().length === 6 && !loading;

  async function copyText(text: string, setCopied: (v: boolean) => void) {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.replace('/(app)/connect')}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={colors.muted} strokeWidth={1.9} />
        </Pressable>
        <Text style={styles.headerTitle}>Connect your agent</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro */}
        <Text style={styles.intro}>
          Pair Summit with your agent in two steps. Paste the prompt into your agent, then enter the code it gives you back.
        </Text>

        {/* Step 1 — agent prompt */}
        <View style={styles.section}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Feed this prompt to your agent</Text>
          </View>
          <View style={styles.card}>
            <ScrollView
              style={styles.codeScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.codeText}>{AGENT_PROMPT}</Text>
            </ScrollView>
            <Pressable
              style={styles.copyRow}
              onPress={() => copyText(AGENT_PROMPT, setPromptCopied)}
            >
              {promptCopied ? (
                <>
                  <Check size={16} color="#4ADE80" strokeWidth={1.7} />
                  <Text style={styles.copiedLabel}>Copied</Text>
                </>
              ) : (
                <>
                  <Copy size={16} color={colors.muted} strokeWidth={1.5} />
                  <Text style={styles.copyLabel}>Copy prompt</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Step 2 — curl command */}
        <View style={styles.section}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Or run this in your terminal</Text>
          </View>
          <View style={styles.card}>
            <Text style={[styles.codeText, styles.curlLine]}>{CURL_COMMAND}</Text>
            <Pressable
              style={styles.copyRow}
              onPress={() => copyText(CURL_COMMAND, setCurlCopied)}
            >
              {curlCopied ? (
                <>
                  <Check size={16} color="#4ADE80" strokeWidth={1.7} />
                  <Text style={styles.copiedLabel}>Copied</Text>
                </>
              ) : (
                <>
                  <Copy size={16} color={colors.muted} strokeWidth={1.5} />
                  <Text style={styles.copyLabel}>Copy command</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Step 3 — pairing code */}
        <View style={styles.section}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <Text style={styles.stepTitle}>Enter the pairing code</Text>
          </View>
          <Text style={styles.stepSubtitle}>
            Your agent will reply with a 6-digit code. Enter it to finish pairing.
          </Text>

          <TextInput
            style={[styles.codeInput, error ? styles.codeInputError : null]}
            placeholder="••••••"
            placeholderTextColor={colors.line}
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
            style={[styles.pairBtn, !canSubmit && styles.btnDisabled]}
            onPress={handlePair}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.pairBtnText}>Pair agent</Text>
            )}
          </Pressable>

          <View style={styles.expiryRow}>
            <Check size={14} color={colors.faint} strokeWidth={1.5} />
            <Text style={styles.expiryText}>Codes expire after 10 minutes</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 26,
  },

  intro: {
    ...typography.small,
    color: colors.muted,
    lineHeight: 22,
    paddingHorizontal: 4,
  },

  section: { gap: 10 },

  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 4,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  stepSubtitle: {
    ...typography.small,
    color: colors.muted,
    lineHeight: 20,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  codeScroll: { maxHeight: 168 },
  codeText: {
    ...typography.mono,
    color: colors.ink2,
    padding: 14,
    paddingHorizontal: 15,
  },
  curlLine: {
    padding: 14,
    paddingHorizontal: 15,
  },

  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderTopWidth: 1,
    borderTopColor: colors.surface2,
  },
  copyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
  },
  copiedLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4ADE80',
  },

  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: 4,
  },

  codeInput: {
    height: 62,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    textAlign: 'center',
    fontFamily: 'Menlo',
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 12,
    color: colors.ink,
  },
  codeInputError: { borderColor: colors.error },
  error: {
    ...typography.caption,
    color: colors.error,
    paddingHorizontal: 4,
  },

  pairBtn: {
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.4 },
  pairBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.bg,
  },

  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 4,
  },
  expiryText: {
    ...typography.caption,
    color: colors.faint,
  },
});
