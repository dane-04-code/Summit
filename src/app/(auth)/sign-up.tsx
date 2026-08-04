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
import { Redirect, useRouter } from 'expo-router';
import * as AuthSession from 'expo-auth-session';
import { useSignUp, useSSO } from '@clerk/clerk-expo';
import { SIGNUP_ENABLED } from '@/config';
import { BrandMark } from '@/ui/BrandMark';
import { AppleLogo, GoogleLogo, GitHubLogo } from '@/ui/authIcons';
import { useWarmUpBrowser } from '@/lib/oauth';
import { colors, space, radius, typography, screenPadding } from '@/theme';

type FocusField = 'email' | 'password' | 'code' | null;

const CODE_LENGTH = 6;

/**
 * Six-box OTP entry: a single hidden TextInput drives real keyboard/paste
 * behavior while the visible boxes just mirror its value. Tapping anywhere
 * in the row focuses the hidden input, so it still feels like one control.
 */
function CodeInput({
  value,
  onChangeText,
  onSubmitEditing,
  focused,
  onFocus,
  onBlur,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.split('');

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={styles.codeRow}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const filled = digits[i] != null;
          const isCursor = focused && i === digits.length;
          return (
            <View
              key={i}
              style={[
                styles.codeBox,
                (filled || isCursor) && styles.codeBoxFocused,
              ]}
            >
              <Text style={styles.codeDigit}>{digits[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.codeHiddenInput}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        returnKeyType="go"
        onSubmitEditing={onSubmitEditing}
        onFocus={onFocus}
        onBlur={onBlur}
        caretHidden
      />
    </Pressable>
  );
}

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [focused, setFocused] = useState<FocusField>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const passwordRef = useRef<TextInput>(null);

  useWarmUpBrowser();

  // Self-serve signup is dev-only; in production the route is inert.
  if (!SIGNUP_ENABLED) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;
  const canVerify = code.trim().length > 0 && !loading;

  async function handleSignUp() {
    if (!isLoaded || !canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signUp.create({ emailAddress: email.trim(), password });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
      } else if (attempt.status === 'missing_requirements') {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setPendingVerification(true);
      } else {
        setError('Sign up needs an extra step. Please try again.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? e?.message ?? 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded || !canVerify) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError('That code didn’t work. Please try again.');
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? e?.message ?? 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? e?.message ?? 'Could not resend the code.');
    }
  }

  async function handleProvider(strategy: 'oauth_apple' | 'oauth_google' | 'oauth_github') {
    setError(null);
    setLoading(true);
    try {
      const { createdSessionId, setActive: activateSSO } = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && activateSSO) {
        await activateSSO({ session: createdSessionId });
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? e?.message ?? 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              <Text style={[styles.title, styles.brandTitle]}>
                {pendingVerification ? 'Check your email' : 'Create your account'}
              </Text>
              <Text style={[styles.subtitle, styles.brandSubtitle]}>
                {pendingVerification
                  ? `Enter the code we sent to ${email.trim()}.`
                  : 'Chat with your agent from anywhere. Setup takes a minute.'}
              </Text>
            </View>

            {pendingVerification ? (
              <>
                {/* verification form */}
                <View style={styles.form}>
                  <CodeInput
                    value={code}
                    onChangeText={setCode}
                    onSubmitEditing={() => canVerify && handleVerify()}
                    focused={focused === 'code'}
                    onFocus={() => setFocused('code')}
                    onBlur={() => setFocused(null)}
                  />
                  {error ? <Text style={[styles.error, styles.codeError]}>{error}</Text> : null}
                </View>

                <View style={styles.actions}>
                  <Pressable
                    style={[styles.primaryBtn, !canVerify && styles.btnDisabled]}
                    onPress={handleVerify}
                    disabled={!canVerify}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.bg} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Verify</Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    Didn&rsquo;t get a code?{' '}
                    <Text style={styles.footerLink} onPress={() => void handleResend()}>
                      Resend
                    </Text>
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* form */}
                <View style={styles.form}>
                  <View>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={[styles.input, focused === 'email' && styles.inputFocused]}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.faint}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      keyboardType="email-address"
                      textContentType="username"
                      autoComplete="email"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                  <View>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      ref={passwordRef}
                      style={[styles.input, focused === 'password' && styles.inputFocused]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.faint}
                      value={password}
                      onChangeText={setPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      textContentType="newPassword"
                      autoComplete="password-new"
                      returnKeyType="go"
                      onSubmitEditing={() => canSubmit && handleSignUp()}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                </View>

                {/* actions */}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
                    onPress={handleSignUp}
                    disabled={!canSubmit}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.bg} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Continue with email</Text>
                    )}
                  </Pressable>

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <Pressable
                    style={[styles.appleBtn, loading && styles.btnDisabled]}
                    onPress={() => handleProvider('oauth_apple')}
                    disabled={loading}
                  >
                    <AppleLogo />
                    <Text style={styles.appleBtnText}>Continue with Apple</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.appleBtn, loading && styles.btnDisabled]}
                    onPress={() => handleProvider('oauth_google')}
                    disabled={loading}
                  >
                    <GoogleLogo />
                    <Text style={styles.appleBtnText}>Continue with Google</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.appleBtn, loading && styles.btnDisabled]}
                    onPress={() => handleProvider('oauth_github')}
                    disabled={loading}
                  >
                    <GitHubLogo />
                    <Text style={styles.appleBtnText}>Continue with GitHub</Text>
                  </Pressable>
                </View>

                {/* footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    Already have an account?{' '}
                    <Text style={styles.footerLink} onPress={() => router.replace('/(auth)/sign-in')}>
                      Sign in
                    </Text>
                  </Text>
                  <Text style={styles.terms}>
                    By creating an account you agree to our{' '}
                    <Text style={styles.termsEmph}>Terms</Text> and{' '}
                    <Text style={styles.termsEmph}>Privacy Policy</Text>.
                  </Text>
                </View>
              </>
            )}
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

  // brand
  brandArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space.xl },
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
  error: { ...typography.caption, color: colors.error, marginLeft: 2 },

  // code entry
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  codeBox: {
    width: 46,
    height: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxFocused: { borderColor: colors.lineFocus },
  codeDigit: { ...typography.title, color: colors.ink },
  codeHiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  codeError: { textAlign: 'center', marginTop: space.sm },

  // actions
  actions: { marginTop: space.lg, gap: space.lg },
  primaryBtn: {
    height: 52,
    borderRadius: radius.control,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { ...typography.body, fontWeight: '600', color: colors.bg },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { ...typography.caption, color: colors.faint },
  appleBtn: {
    height: 52,
    borderRadius: radius.control,
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
