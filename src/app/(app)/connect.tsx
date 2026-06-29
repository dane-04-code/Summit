import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Bot } from 'lucide-react-native';
import { useAgents } from '@/agents/AgentProvider';
import { connectDirectAgent } from '@/agents/connect';
import { ConnectionError } from '@/agents/adapters/types';
import { colors, space, radius, typography, screenPadding } from '@/theme';

type FocusField = 'name' | 'host' | 'key' | null;

export default function ConnectScreen() {
  const { addAgent } = useAgents();
  const router = useRouter();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [focused, setFocused] = useState<FocusField>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = host.trim().length > 0 && apiKey.trim().length > 0 && !loading;

  async function handleConnect() {
    setError(null);
    setLoading(true);
    try {
      const { input, secret } = await connectDirectAgent({ name, host, apiKey });
      await addAgent(input, secret);
      router.replace('/(app)');
    } catch (e) {
      setError(
        e instanceof ConnectionError
          ? e.message
          : 'Could not connect. Check the host and try again.',
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
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.brandArea}>
              <View style={styles.brandMark}>
                <Bot size={30} color={colors.bg} strokeWidth={1.7} />
              </View>
              <Text style={[styles.title, styles.brandTitle]}>Connect your agent</Text>
              <Text style={[styles.subtitle, styles.brandSubtitle]}>
                Point Summit at your Hermes server. The host and API key stay on this device.
              </Text>
            </View>

            <View style={styles.form}>
              <View>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={[styles.input, focused === 'name' && styles.inputFocused]}
                  placeholder="Hermes"
                  placeholderTextColor={colors.faint}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View>
                <Text style={styles.label}>Host</Text>
                <TextInput
                  style={[styles.input, focused === 'host' && styles.inputFocused]}
                  placeholder="agent.example.com:8642"
                  placeholderTextColor={colors.faint}
                  value={host}
                  onChangeText={setHost}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onFocus={() => setFocused('host')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View>
                <Text style={styles.label}>API key</Text>
                <View style={styles.keyWrap}>
                  <TextInput
                    style={[styles.input, styles.keyInput, focused === 'key' && styles.inputFocused]}
                    placeholder="API_SERVER_KEY"
                    placeholderTextColor={colors.faint}
                    value={apiKey}
                    onChangeText={setApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showKey}
                    onFocus={() => setFocused('key')}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={() => canSubmit && handleConnect()}
                    returnKeyType="go"
                  />
                  <Pressable
                    style={styles.revealBtn}
                    onPress={() => setShowKey((s) => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}
                    hitSlop={8}
                  >
                    <Text style={styles.revealText}>{showKey ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>

            <Pressable
              style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
              onPress={handleConnect}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.primaryBtnText}>Connect</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.push('/(app)/pair' as '/')} hitSlop={8}>
              <Text style={styles.pairLink}>Use pairing code instead</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, paddingHorizontal: screenPadding, paddingBottom: space.lg },

  brandArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space.xl },
  brandMark: {
    width: 60,
    height: 60,
    borderRadius: radius.bubble,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.title, color: colors.ink, textAlign: 'center', letterSpacing: -0.5 },
  brandTitle: { marginTop: space.xl },
  subtitle: { ...typography.small, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  brandSubtitle: { marginTop: space.sm },

  form: { gap: space.md },
  label: { ...typography.caption, color: colors.muted, marginBottom: 6, marginLeft: 2 },
  input: {
    ...typography.body,
    color: colors.ink,
    height: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.lineFocus },
  keyWrap: { position: 'relative', justifyContent: 'center' },
  keyInput: { paddingRight: 64 },
  revealBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealText: { ...typography.caption, color: colors.muted },
  error: { ...typography.caption, color: colors.error, marginLeft: 2 },

  primaryBtn: {
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { ...typography.body, fontWeight: '600', color: colors.bg },
  pairLink: { ...typography.caption, color: colors.muted, textAlign: 'center', marginTop: space.sm },
});
