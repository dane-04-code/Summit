import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { useAgents } from '@/agents/AgentProvider';
import { defaultCapabilitiesFor, frameworkLabel, parseFramework } from '@/agents/frameworks';
import { resolvePushToken } from '@/notifications/push';
import { RelayClient } from '@/agents/relay/client';
import { RelayError, isPairingCodeError } from '@/agents/relay/errors';
import { captureError } from '@/lib/errorReporting';
import { RELAY_WS_URL } from '@/config';
import { colors, space, radius, typography, screenPadding } from '@/theme';
import { encodeRelayCredential } from '@/agents/relay/credential';
import { formatPairingCode, isPairingCode, normalizePairingCode } from '@/agents/relay/pairingCode';

export const CURL_COMMAND = 'curl -fsSL https://get.summitapp.dev/connect | sh';

export const AGENT_PROMPT = `Connect this agent to my Summit mobile app.

Run this exact command on the machine where you are running:

${CURL_COMMAND}

When it finishes, reply with only the pairing code it prints. If it fails, send me the full error output instead.`;

export default function PairScreen() {
  const { addAgent, agents } = useAgents();
  const router = useRouter();
  // First run this screen is the unskippable start of the app. Reached again to
  // add a second agent, it's an ordinary pushed screen you can back out of.
  const isAddingAnother = agents.length > 0;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const [copied, setCopied] = useState<'prompt' | 'command' | null>(null);
  const clientRef = useRef<RelayClient | null>(null);

  // `code` is always canonical (unhyphenated, uppercase); the dash is display only.
  const canSubmit = isPairingCode(code) && !loading;

  async function copyText(kind: 'prompt' | 'command') {
    await Clipboard.setStringAsync(kind === 'prompt' ? AGENT_PROMPT : CURL_COMMAND);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  async function handlePair() {
    setError(null);
    setCodeError(false);
    setLoading(true);
    try {
      const wsUrl = `${RELAY_WS_URL}?code=${encodeURIComponent(code)}`;
      const client = new RelayClient(wsUrl);
      clientRef.current = client;
      const info = await client.pair(code);
      client.disconnect();
      clientRef.current = null;

      const credential = encodeRelayCredential({ code, token: info.sessionToken });
      const authenticatedClient = new RelayClient(
        `${RELAY_WS_URL}?code=${encodeURIComponent(code)}&token=${encodeURIComponent(info.sessionToken)}`,
      );
      clientRef.current = authenticatedClient;
      await authenticatedClient.resume(info.sessionToken);

      try {
        const pushToken = await resolvePushToken();
        if (pushToken) await authenticatedClient.registerPush(pushToken, 'all');
      } catch (e) {
        captureError(e, { where: 'push_register', transport: 'relay' });
      }

      authenticatedClient.disconnect();
      clientRef.current = null;

      const framework = parseFramework(info.framework);
      await addAgent(
        {
          name: info.agentName || frameworkLabel(framework),
          framework,
          transport: 'relay',
          baseUrl: null,
          capabilities: defaultCapabilitiesFor(framework),
          connectionVia: info.via ?? 'connector',
        },
        credential,
      );
      router.replace('/(app)');
    } catch (e) {
      if (e instanceof RelayError) {
        setError(e.message);
        setCodeError(isPairingCodeError(e.code));
        if (!isPairingCodeError(e.code)) captureError(e, { where: 'pair', transport: 'relay' });
      } else {
        setError(e instanceof Error ? e.message : 'Pairing failed. Check the code and try again.');
        setCodeError(true);
        captureError(e, { where: 'pair', transport: 'relay' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ gestureEnabled: isAddingAnother }} />
      <ScreenHeader
        title={isAddingAnother ? 'Add an agent' : 'Pair your agent'}
        showBack={isAddingAnother}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Text style={styles.intro}>
            Paste this prompt into your agent, then enter the code it returns. Your API key stays
            on your server.
          </Text>

          <View style={styles.step}>
            <StepHeader number="1" title="Ask your agent" />

            <View style={styles.promptCard}>
              <Text style={styles.promptText}>Connect this agent to my Summit mobile app.</Text>
              <Text style={styles.promptInstruction}>
                Run this exact command on the machine where you are running:
              </Text>
              <View style={styles.commandBox}>
                <Text style={styles.commandText} selectable>
                  {CURL_COMMAND}
                </Text>
              </View>
              <Text style={styles.promptText}>
                When it finishes, reply with only the pairing code it prints. If it fails, send me
                the full error output instead.
              </Text>

              <View style={styles.copyActions}>
                <CopyButton
                  label={copied === 'prompt' ? 'Prompt copied' : 'Copy prompt'}
                  copied={copied === 'prompt'}
                  onPress={() => copyText('prompt')}
                />
                <View style={styles.copyDivider} />
                <CopyButton
                  label={copied === 'command' ? 'Command copied' : 'Copy command'}
                  copied={copied === 'command'}
                  onPress={() => copyText('command')}
                />
              </View>
            </View>
          </View>

          <View style={styles.step}>
            <StepHeader number="2" title="Enter the code" />

            <TextInput
              accessibilityLabel="Pairing code"
              style={[styles.codeInput, codeError && styles.codeInputError]}
              placeholder="XXXX-XXXX"
              placeholderTextColor={colors.lineFocus}
              // Show the grouped form, keep the canonical one in state. Typing
              // past the dash still works: normalize discards it either way.
              value={formatPairingCode(code)}
              onChangeText={(value) => {
                setError(null);
                setCodeError(false);
                setCode(normalizePairingCode(value));
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              // Codes are alphanumeric now, so no numeric keypad and no
              // one-time-code autofill — that heuristic only matches SMS digits.
              autoComplete="off"
              textContentType="none"
              maxLength={9}
              returnKeyType="go"
              onSubmitEditing={() => canSubmit && handlePair()}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.pairButton,
                !canSubmit && styles.disabled,
                pressed && canSubmit && styles.pairButtonPressed,
              ]}
              onPress={handlePair}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.pairButtonText}>Pair agent</Text>
              )}
            </Pressable>

            <View style={styles.securityNote}>
              <Check size={13} color={colors.faint} strokeWidth={1.8} />
              <Text style={styles.securityText}>Single-use code · rotates every 3 minutes</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepHeader({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
    </View>
  );
}

function CopyButton({
  label,
  copied,
  onPress,
}: {
  label: string;
  copied: boolean;
  onPress: () => void;
}) {
  const Icon = copied ? Check : Copy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
    >
      <Icon
        size={15}
        color={copied ? colors.success : colors.ink2}
        strokeWidth={1.8}
      />
      <Text style={[styles.copyButtonText, copied && styles.copiedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: screenPadding,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.xl,
  },
  intro: { ...typography.small, color: colors.muted, lineHeight: 21, maxWidth: 340 },

  step: { gap: space.md },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { ...typography.caption, color: colors.ink, fontWeight: '600' },
  stepTitle: { ...typography.small, color: colors.ink, fontWeight: '600' },

  promptCard: {
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    padding: space.lg,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  promptText: { ...typography.small, color: colors.ink2, lineHeight: 21 },
  promptInstruction: {
    ...typography.caption,
    color: colors.muted,
    lineHeight: 18,
    marginTop: space.md,
  },
  commandBox: {
    backgroundColor: colors.codeBlockBg,
    borderRadius: radius.code,
    marginVertical: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  commandText: { ...typography.mono, color: colors.ink, fontSize: 12, lineHeight: 18 },
  copyActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    marginHorizontal: -space.lg,
    marginTop: space.lg,
  },
  copyButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  copyButtonPressed: { backgroundColor: colors.surface },
  copyButtonText: { ...typography.caption, color: colors.ink2, fontWeight: '500' },
  copiedText: { color: colors.success },
  copyDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.line },

  codeInput: {
    height: 60,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    color: colors.ink,
    textAlign: 'center',
    fontFamily: 'Menlo',
    // Sized for nine glyphs (eight plus the dash) rather than six, so the code
    // still fits without wrapping on the narrowest phones. paddingLeft offsets
    // the trailing letter-space so the text stays optically centred.
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 7,
    paddingLeft: 7,
  },
  codeInputError: { borderColor: colors.error },
  error: { ...typography.caption, color: colors.error, paddingHorizontal: space.xs },
  pairButton: {
    height: 52,
    borderRadius: radius.control,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairButtonPressed: { backgroundColor: colors.ink2 },
  disabled: { opacity: 0.35 },
  pairButtonText: { ...typography.body, color: colors.bg, fontWeight: '600' },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  securityText: { ...typography.caption, color: colors.faint },
});
