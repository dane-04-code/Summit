import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';
import { SIGNUP_ENABLED } from '@/config';
import { BrandMark } from '@/ui/BrandMark';
import { EyeIcon, AppleLogo } from '@/ui/authIcons';
import { colors, space, radius, typography, screenPadding } from '@/theme';

type FocusField = 'email' | 'password' | null;

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<FocusField>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleEmailSignIn() {
    setError(null);
    if (!SUPABASE_CONFIGURED) {
      setError('Sign in is not configured for this build yet.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
  }

  async function handleApple() {
    setError(null);
    if (!SUPABASE_CONFIGURED) {
      setError('Sign in is not configured for this build yet.');
      return;
    }
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        testID="sign-in-scroll"
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* brand */}
          <View style={styles.brandArea}>
            <BrandMark />
            <Text style={[styles.title, styles.brandTitle]}>Welcome back</Text>
            <Text style={[styles.subtitle, styles.brandSubtitle]}>
              Sign in to pick up where you and your agent left off.
            </Text>
          </View>

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
                  placeholder="Your password"
                  placeholderTextColor={colors.faint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textContentType="password"
                  autoComplete="current-password"
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={handleEmailSignIn}
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
              onPress={handleEmailSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.primaryBtnText}>Sign in</Text>
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
          {SIGNUP_ENABLED && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                No account yet?{' '}
                <Text
                  style={styles.footerLink}
                  onPress={() => router.replace('/(auth)/sign-up')}
                >
                  Create one
                </Text>
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
});
