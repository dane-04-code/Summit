import React, { useEffect, useState } from 'react';
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
import { Redirect, useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { SIGNUP_ENABLED } from '@/config';
import { colors, space, radius, typography, screenPadding } from '@/theme';

// --- icons (module scope so they aren't recreated on every render) -----------

function BrandMark() {
  return (
    <View style={styles.brandMark}>
      <Svg width={32} height={32} viewBox="0 0 18 18" fill="none">
        <Path
          d="M3.2 13.2c0-3.2 2.6-5.8 5.8-5.8s5.8 2.6 5.8 5.8M9 4.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z"
          stroke={colors.bg}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M2.5 10S5.5 4.5 10 4.5 17.5 10 17.5 10 14.5 15.5 10 15.5 2.5 10 2.5 10Z"
        stroke={colors.muted}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Circle cx={10} cy={10} r={2.2} stroke={colors.muted} strokeWidth={1.5} />
      {off ? (
        <Path d="M4 4 16 16" stroke={colors.muted} strokeWidth={1.5} strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

function AppleLogo() {
  return (
    <Svg width={17} height={20} viewBox="0 0 17 20" fill="none">
      <Path
        d="M14 14.7c-.3.7-.5 1-.9 1.6-.6.9-1.4 2-2.5 2-.9 0-1.2-.6-2.4-.6s-1.5.6-2.4.6c-1.1 0-1.8-1-2.4-1.9C1.6 14.4.9 11 2.1 8.7c.7-1.3 1.9-2.1 3-2.1 1.1 0 1.8.6 2.7.6.9 0 1.4-.6 2.7-.6 1 0 2 .5 2.7 1.4-2.4 1.3-2 4.7.8 6.3ZM10.3 4.4c.5-.7.9-1.6.8-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.5-.8 2.5.9.1 1.8-.5 2.4-1.2Z"
        fill={colors.ink}
      />
    </Svg>
  );
}

type FocusField = 'name' | 'email' | 'password' | null;

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<FocusField>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then((v) => {
        if (active) setAppleAvailable(v);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  // Self-serve signup is dev-only; in production the route is inert.
  if (!SIGNUP_ENABLED) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  async function handleSignUp() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setConfirmed(true);
  }

  async function handleApple() {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setError('Apple did not return an identity token.');
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      setLoading(false);
      if (error) setError(error.message);
    } catch (e: any) {
      // User dismissed the native Apple sheet — nothing to surface.
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      setError(e?.message ?? 'Apple sign-in failed.');
    }
  }

  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.confirmContainer}>
          <BrandMark />
          <Text style={[styles.title, styles.brandTitle]}>Check your email</Text>
          <Text style={[styles.subtitle, styles.brandSubtitle]}>
            We sent a confirmation link to {email.trim()}. Tap it to activate your account.
          </Text>
          <Pressable
            style={[styles.primaryBtn, styles.confirmBtn]}
            onPress={() => router.replace('/(auth)/sign-in')}
          >
            <Text style={styles.primaryBtnText}>Back to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
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
            {/* brand */}
            <View style={styles.brandArea}>
              <BrandMark />
              <Text style={[styles.title, styles.brandTitle]}>Create your account</Text>
              <Text style={[styles.subtitle, styles.brandSubtitle]}>
                Your personal agents, in one quiet place. Set up takes a moment.
              </Text>
            </View>

            {/* form */}
            <View style={styles.form}>
              <View>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={[styles.input, focused === 'name' && styles.inputFocused]}
                  placeholder="Alex Rivera"
                  placeholderTextColor={colors.faint}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  textContentType="name"
                  autoComplete="name"
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, focused === 'email' && styles.inputFocused]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.faint}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      focused === 'password' && styles.inputFocused,
                    ]}
                    placeholder="At least 8 characters"
                    placeholderTextColor={colors.faint}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={handleSignUp}
                    returnKeyType="go"
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((s) => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    hitSlop={8}
                  >
                    <EyeIcon off={showPassword} />
                  </Pressable>
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>

            {/* actions */}
            <View style={styles.actions}>
              <Pressable
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.primaryBtnText}>Create account</Text>
                )}
              </Pressable>

              {appleAvailable && (
                <>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <Pressable
                    style={[styles.appleBtn, loading && styles.btnDisabled]}
                    onPress={handleApple}
                    disabled={loading}
                  >
                    <AppleLogo />
                    <Text style={styles.appleBtnText}>Continue with Apple</Text>
                  </Pressable>
                </>
              )}
            </View>

            {/* footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
                <Text
                  style={styles.footerLink}
                  onPress={() => router.replace('/(auth)/sign-in')}
                >
                  Sign in
                </Text>
              </Text>
              <Text style={styles.terms}>
                By creating an account you agree to our{' '}
                <Text style={styles.termsEmph}>Terms</Text> and{' '}
                <Text style={styles.termsEmph}>Privacy Policy</Text>.
              </Text>
            </View>
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
  confirmContainer: {
    flex: 1,
    paddingHorizontal: screenPadding,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // brand
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
  subtitle: { ...typography.small, color: colors.muted, textAlign: 'center', maxWidth: 280 },
  brandSubtitle: { marginTop: space.sm },

  // form
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
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 46 },
  eyeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typography.caption, color: colors.error, marginLeft: 2 },

  // actions
  actions: { marginTop: space.lg, gap: space.lg },
  primaryBtn: {
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: { alignSelf: 'stretch', marginTop: space.xl },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { ...typography.body, fontWeight: '600', color: colors.bg },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { ...typography.caption, color: colors.faint },
  appleBtn: {
    height: 52,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  appleBtnText: { ...typography.body, fontWeight: '500', color: colors.ink },

  // footer
  footer: { marginTop: space.lg, alignItems: 'center' },
  footerText: { ...typography.small, color: colors.muted, textAlign: 'center' },
  footerLink: { color: colors.accent, fontWeight: '500' },
  terms: {
    ...typography.caption,
    color: colors.faint,
    textAlign: 'center',
    marginTop: space.md,
    maxWidth: 280,
    lineHeight: 17,
  },
  termsEmph: { color: colors.muted },
});
