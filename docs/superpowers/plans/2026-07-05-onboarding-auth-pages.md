# Onboarding & Auth Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Welcome landing screen, rebuild the sign-in screen to match the sign-up screen's quality, unify the brand mark on the mountain-peak glyph, and route signed-out users to Welcome.

**Architecture:** All screens live in the existing `(auth)` expo-router group. A shared `BrandMark`/`PeakGlyph` component and shared auth icons remove duplication between the three screens. The only routing change is the `RouteGuard` redirect target. The pair screen is untouched.

**Tech Stack:** Expo SDK 56, expo-router, react-native-svg, lucide-react-native, core RN `Animated` (not Reanimated — no jest mock configured), Supabase auth (unchanged), jest-expo + RNTL.

## Global Constraints

- Design tokens only — import `colors`, `space`, `radius`, `typography`, `screenPadding` from `@/theme`; no raw hex or magic numbers.
- Dark-only; primary buttons are `colors.ink` fill (NOT accent); accent used sparingly.
- RNTL `render()` must be awaited in this repo.
- `__DEV__` is true under jest, so `SIGNUP_ENABLED` is true in tests without mocking.
- New typed routes need `as '/'` casts until `expo start` regenerates types (existing pattern in `src/app/(app)/_layout.tsx:15`).
- Green bar: `npx tsc --noEmit` + `npm test` both pass.
- Commit only files this plan touches — the working tree has unrelated in-progress changes (streamReducer/approval work). Never `git add -A`.

---

### Task 1: Shared brand mark + auth icons

**Files:**
- Create: `src/ui/BrandMark.tsx`
- Create: `src/ui/authIcons.tsx`
- Test: `__tests__/ui/brandMark.test.tsx`

**Interfaces:**
- Produces: `PeakGlyph({ size?: number; color?: string })`, `BrandMark({ size?: number })` from `@/ui/BrandMark`; `EyeIcon({ off?: boolean })`, `AppleLogo()` from `@/ui/authIcons`.

- [ ] **Step 1: Write the failing test**

`__tests__/ui/brandMark.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';

import { BrandMark, PeakGlyph } from '@/ui/BrandMark';

it('renders the brand tile with the peak glyph', async () => {
  const result = await render(<BrandMark />);
  expect(result.toJSON()).not.toBeNull();
});

it('renders the standalone glyph', async () => {
  const result = await render(<PeakGlyph size={64} />);
  expect(result.toJSON()).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/ui/brandMark.test.tsx`
Expected: FAIL — cannot find module `@/ui/BrandMark`.

- [ ] **Step 3: Write the implementation**

`src/ui/BrandMark.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '@/theme';

/** The Summit mountain-peak glyph (the rounded Λ from the app icon). */
export function PeakGlyph({ size = 32, color = colors.bg }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M3.4 14.2 9 3.8l5.6 10.4"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The glyph in the rounded-square ink tile used at the top of auth screens. */
export function BrandMark({ size = 60 }: { size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size }]}>
      <PeakGlyph size={Math.round(size * 0.53)} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.bubble,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

`src/ui/authIcons.tsx` (moved verbatim from `sign-up.tsx`'s local icons):

```tsx
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@/theme';

export function EyeIcon({ off }: { off?: boolean }) {
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

export function AppleLogo() {
  return (
    <Svg width={17} height={20} viewBox="0 0 17 20" fill="none">
      <Path
        d="M14 14.7c-.3.7-.5 1-.9 1.6-.6.9-1.4 2-2.5 2-.9 0-1.2-.6-2.4-.6s-1.5.6-2.4.6c-1.1 0-1.8-1-2.4-1.9C1.6 14.4.9 11 2.1 8.7c.7-1.3 1.9-2.1 3-2.1 1.1 0 1.8.6 2.7.6.9 0 1.4-.6 2.7-.6 1 0 2 .5 2.7 1.4-2.4 1.3-2 4.7.8 6.3ZM10.3 4.4c.5-.7.9-1.6.8-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.5-.8 2.5.9.1 1.8-.5 2.4-1.2Z"
        fill={colors.ink}
      />
    </Svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/ui/brandMark.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/BrandMark.tsx src/ui/authIcons.tsx __tests__/ui/brandMark.test.tsx
git commit -m "feat(auth): shared peak brand mark + auth icons"
```

---

### Task 2: Welcome screen

**Files:**
- Create: `src/app/(auth)/welcome.tsx`
- Test: `__tests__/auth/welcome.test.tsx`

**Interfaces:**
- Consumes: `PeakGlyph` from `@/ui/BrandMark`; `SIGNUP_ENABLED` from `@/config`.
- Produces: route `/(auth)/welcome` (default export screen).

- [ ] **Step 1: Write the failing test**

`__tests__/auth/welcome.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import WelcomeScreen from '@/app/(auth)/welcome';

beforeEach(() => mockPush.mockClear());

it('renders the hero and all four feature cards', async () => {
  await render(<WelcomeScreen />);

  expect(screen.getByText('Summit')).toBeTruthy();
  expect(screen.getByText('Your agent, in your pocket.')).toBeTruthy();
  expect(screen.getByText('Talk to it anywhere')).toBeTruthy();
  expect(screen.getByText('Watch it work')).toBeTruthy();
  expect(screen.getByText('Stay in control')).toBeTruthy();
  expect(screen.getByText('Private by design')).toBeTruthy();
});

it('routes Get started to sign-up (signup enabled in dev/test)', async () => {
  await render(<WelcomeScreen />);
  fireEvent.press(screen.getByText('Get started'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');
});

it('routes the sign-in link to sign-in', async () => {
  await render(<WelcomeScreen />);
  fireEvent.press(screen.getByText(/Already have an account/));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-in');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/auth/welcome.test.tsx`
Expected: FAIL — cannot find module `@/app/(auth)/welcome`.

- [ ] **Step 3: Write the implementation**

`src/app/(auth)/welcome.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle, Zap, BadgeCheck, Lock } from 'lucide-react-native';
import { SIGNUP_ENABLED } from '@/config';
import { PeakGlyph } from '@/ui/BrandMark';
import { colors, space, radius, typography, screenPadding } from '@/theme';

const GLOW = require('@/assets/images/logo-glow.png');

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'Talk to it anywhere',
    body: 'A real chat with your self-hosted agent — wherever you are.',
  },
  {
    icon: Zap,
    title: 'Watch it work',
    body: 'Replies stream in live, with proper markdown and code.',
  },
  {
    icon: BadgeCheck,
    title: 'Stay in control',
    body: 'Approve or stop runs from your phone the moment it asks.',
  },
  {
    icon: Lock,
    title: 'Private by design',
    body: 'Keys stay in your keychain. Messages go only to your own server.',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [intro]);

  function onPagerEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  const introStyle = {
    opacity: intro,
    transform: [
      { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
    ],
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.flex, introStyle]}>
        {/* hero */}
        <View style={styles.hero}>
          <View style={styles.markWrap}>
            <Image source={GLOW} style={styles.glow} />
            <PeakGlyph size={64} color={colors.ink} />
          </View>
          <Text style={styles.wordmark}>Summit</Text>
          <Text style={styles.tagline}>Your agent, in your pocket.</Text>
        </View>

        {/* what's included — swipeable */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerEnd}
          style={styles.pager}
        >
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <View key={title} style={[styles.slide, { width }]}>
              <View style={styles.slideIcon}>
                <Icon size={20} color={colors.accent} strokeWidth={1.7} />
              </View>
              <Text style={styles.slideTitle}>{title}</Text>
              <Text style={styles.slideBody}>{body}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {FEATURES.map((f, i) => (
            <View key={f.title} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        {/* actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push(SIGNUP_ENABLED ? '/(auth)/sign-up' : '/(auth)/sign-in')}
          >
            <Text style={styles.primaryBtnText}>Get started</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push('/(auth)/sign-in')}
            hitSlop={8}
          >
            <Text style={styles.secondaryText}>
              Already have an account? <Text style={styles.secondaryLink}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 200, height: 200, opacity: 0.55 },
  wordmark: {
    ...typography.title,
    color: colors.ink,
    letterSpacing: -0.5,
    marginTop: space.sm,
  },
  tagline: { ...typography.body, color: colors.muted, marginTop: space.sm },

  pager: { flexGrow: 0 },
  slide: { alignItems: 'center', paddingHorizontal: screenPadding * 2, gap: space.sm },
  slideIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  slideTitle: { ...typography.h, color: colors.ink, textAlign: 'center' },
  slideBody: { ...typography.small, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.accent },

  actions: {
    paddingHorizontal: screenPadding,
    marginTop: space.xl,
    marginBottom: space.lg,
    gap: space.md,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...typography.body, fontWeight: '600', color: colors.bg },
  secondaryBtn: { alignItems: 'center', paddingVertical: space.sm },
  secondaryText: { ...typography.small, color: colors.muted },
  secondaryLink: { color: colors.accent, fontWeight: '500' },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/auth/welcome.test.tsx`
Expected: PASS (3 tests). If the `require('@/assets/...')` alias fails under jest, switch to the relative path `require('../../../assets/images/logo-glow.png')`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/welcome.tsx __tests__/auth/welcome.test.tsx
git commit -m "feat(auth): welcome screen with feature pager"
```

---

### Task 3: Route signed-out users to Welcome

**Files:**
- Modify: `src/app/_layout.tsx:24` (RouteGuard redirect target)

**Interfaces:**
- Consumes: route `/(auth)/welcome` from Task 2.

- [ ] **Step 1: Change the redirect**

In `src/app/_layout.tsx`, replace:

```tsx
      router.replace('/(auth)/sign-in');
```

with:

```tsx
      router.replace('/(auth)/welcome' as '/'); // typed route added on next expo start
```

- [ ] **Step 2: Verify green bar**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npx jest __tests__/context/AuthContext.test.tsx` — expected: PASS (guard isn't under test there, but confirm nothing asserts the old target).

- [ ] **Step 3: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat(auth): land signed-out users on the welcome screen"
```

---

### Task 4: Rebuild sign-in

**Files:**
- Rewrite: `src/app/(auth)/sign-in.tsx`
- Test: `__tests__/auth/signIn.test.tsx`

**Interfaces:**
- Consumes: `BrandMark` from `@/ui/BrandMark`; `EyeIcon`, `AppleLogo` from `@/ui/authIcons`; `supabase.auth.signInWithPassword` / `signInWithIdToken` (unchanged).

- [ ] **Step 1: Write the failing test**

`__tests__/auth/signIn.test.tsx`:

```tsx
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

const mockSignIn = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => mockSignIn(...a) } },
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  signInAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

import SignInScreen from '@/app/(auth)/sign-in';

beforeEach(() => mockSignIn.mockReset());

it('submits trimmed credentials to Supabase', async () => {
  mockSignIn.mockResolvedValue({ error: null });
  await render(<SignInScreen />);

  fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), ' me@site.dev ');
  fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'hunter22');
  await act(async () => {
    fireEvent.press(screen.getByText('Sign in'));
  });

  expect(mockSignIn).toHaveBeenCalledWith({ email: 'me@site.dev', password: 'hunter22' });
});

it('surfaces auth errors', async () => {
  mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
  await render(<SignInScreen />);

  fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'me@site.dev');
  fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'nope');
  await act(async () => {
    fireEvent.press(screen.getByText('Sign in'));
  });

  expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/auth/signIn.test.tsx`
Expected: FAIL — old screen has placeholder `Email`, not `you@example.com`.

- [ ] **Step 3: Rewrite the screen**

`src/app/(auth)/sign-in.tsx` — full replacement (structure mirrors `sign-up.tsx`; Supabase calls unchanged):

```tsx
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
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/auth/signIn.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/sign-in.tsx __tests__/auth/signIn.test.tsx
git commit -m "feat(auth): rebuild sign-in to match the sign-up structure"
```

---

### Task 5: Sign-up touch-up

**Files:**
- Modify: `src/app/(auth)/sign-up.tsx` (swap to shared components, copy tweak)

**Interfaces:**
- Consumes: `BrandMark` from `@/ui/BrandMark`; `EyeIcon`, `AppleLogo` from `@/ui/authIcons`.

- [ ] **Step 1: Swap local icons for shared components**

In `src/app/(auth)/sign-up.tsx`:
- Delete the local `BrandMark`, `EyeIcon`, and `AppleLogo` function definitions and the now-unused `Svg`/`Path`/`Circle` import.
- Add imports: `import { BrandMark } from '@/ui/BrandMark';` and `import { EyeIcon, AppleLogo } from '@/ui/authIcons';`.
- Delete the `brandMark` entry from the StyleSheet (the tile style now lives in the shared component).
- Change the subtitle copy from `Your personal agents, in one quiet place. Set up takes a moment.` to `Chat with your agent from anywhere. Setup takes a minute.`

- [ ] **Step 2: Verify green bar**

Run: `npx tsc --noEmit` — expected: no errors (catches any orphaned imports/styles).
Run: `npm test` — expected: full suite PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/sign-up.tsx
git commit -m "refactor(auth): sign-up uses the shared peak brand mark"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full green bar**

Run: `npx tsc --noEmit` then `npm test`.
Expected: both pass.

- [ ] **Step 2: Log the slice**

Append a dated entry to `.sdd/progress.md` describing the onboarding/auth slice. Do **not** commit this file — it carries unrelated uncommitted changes from parallel work; leave staging it to Dane.
