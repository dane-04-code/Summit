import React, { useState } from 'react';
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
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, space, radius, typography, screenPadding } from '@/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSignIn() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Agent Messenger</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleEmailSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.btnText}>Sign in</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href="/(auth)/sign-up" style={styles.link}>
            <Text style={styles.linkText}>No account? Sign up</Text>
          </Link>
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
  },
  title: { ...typography.title, color: colors.ink, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.muted, textAlign: 'center' },
  form: { gap: space.sm },
  input: {
    ...typography.body,
    color: colors.ink,
    height: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
  },
  error: { ...typography.caption, color: '#FF6B6B' },
  btn: {
    height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { ...typography.body, color: colors.bg, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { ...typography.caption, color: colors.muted },
  link: { alignSelf: 'center' },
  linkText: { ...typography.body, color: colors.accent },
});
