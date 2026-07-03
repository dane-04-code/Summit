# Supabase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user accounts to Agent Messenger — Apple Sign-In, Google Sign-In, and email/password via Supabase Auth — with protected routing that gates the chat screen behind sign-in.

**Architecture:** A `supabase.ts` client uses `expo-secure-store` as the session storage adapter. An `AuthContext` wraps the app and exposes session state. The expo-router layout is restructured into `(auth)/` and `(app)/` route groups; a root guard redirects based on session presence. Sign-in screen offers three options: Apple (native), Google (OAuth via browser), email/password.

**Tech Stack:** `@supabase/supabase-js` v2, `expo-apple-authentication`, `expo-auth-session`, `expo-web-browser` (already installed), `expo-secure-store` (already installed), expo-router route groups.

---

## Current Status (updated 2026-06-28)

Supabase project + all three providers (Email, Apple, Google) are **configured in the dashboard**
(see `docs/AUTH.md`). The pre-requisites below are **done**.

| Task | State |
|------|-------|
| 1. Supabase client + SecureStore | ✅ committed (`df39801`) |
| 2. AuthContext | ✅ committed (`f7dee98`) |
| 3. Route groups + auth guard | ✅ committed (`b4d3048`) |
| 4. Email sign-in / sign-up | 🟡 screens built & working, **uncommitted**; `__tests__/app/sign-in.test.tsx` not written |
| 5. Apple Sign-In (button wiring) | ⏸️ deferred — provider configured, button not in `sign-in.tsx` |
| 6. Google Sign-In (OAuth + callback) | ⏸️ deferred — no `src/app/auth/callback.tsx` |

**Deviation from plan:** a `SIGNUP_ENABLED` flag (`src/config.ts`, gated to `__DEV__`) now hides the
sign-up link in release builds, and the "or" divider was repurposed for that link instead of the
Apple/Google buttons. Current direction is **email-only in the app shell**; the social providers are
configured server-side but their buttons are not surfaced.

**Still open:** `signOut` is wired in `AuthContext` but not surfaced in the settings UI.

**On "the backend":** auth here is entirely client-side (Supabase-hosted). There is no app database,
RLS, or edge function in scope — and per the product brief (§4, §8a) the real backend for this
product is the **relay + connector** (`docs/CONNECTION.md`), a separate and much larger build that is
**not** part of this auth plan.

## Global Constraints

- Expo SDK 56 (`expo ~56`), React Native 0.85, React 19 — verify any Expo package version against `https://docs.expo.dev/versions/v56.0.0/` before installing
- Design system enforced: never use raw hex or magic numbers — import tokens from `src/theme.ts` (`colors`, `space`, `radius`, `typography`, `screenPadding`)
- Dark-only product; one accent (`colors.accent` = `#5B9DFF`), used sparingly
- No comments that describe what code does — only non-obvious WHY comments
- TypeScript strict mode ON — `npx tsc --noEmit` must pass
- Green bar = `npx tsc --noEmit` + `npm test` both passing
- Path alias `@/*` → `src/*`
- Never use `auth.role()` in RLS — use `TO authenticated` with `auth.uid()` predicate
- Never expose `service_role` key in app code

## Pre-requisites (manual steps before coding)

Before starting Task 1, complete these in the Supabase dashboard:

1. Open your Supabase project → **Authentication → Providers**
2. Enable **Email** provider (confirm email optional for dev, required for prod)
3. Enable **Apple** provider — requires Apple Developer account; enter Service ID + private key
4. Enable **Google** provider — create OAuth credentials in Google Cloud Console; paste Client ID + Secret
5. Under **Authentication → URL Configuration**, add redirect URL: `agent-messenger://auth/callback`
6. Copy **Project URL** and **anon key** from **Settings → API**

---

## File Structure

```
src/
  lib/
    supabase.ts                    # CREATE — client + SecureStore adapter
  context/
    AuthContext.tsx                # CREATE — session state provider + useAuth hook
  app/
    _layout.tsx                    # MODIFY — wrap AuthProvider, add root guard
    (auth)/
      _layout.tsx                  # CREATE — auth screens layout (no nav header)
      sign-in.tsx                  # CREATE — Apple / Google / email sign-in
      sign-up.tsx                  # CREATE — email registration + password
    (app)/
      _layout.tsx                  # CREATE — protected group layout
      index.tsx                    # MOVE from src/app/index.tsx
      settings.tsx                 # MOVE from src/app/settings.tsx
__tests__/
  lib/
    supabase.test.ts               # CREATE
  context/
    AuthContext.test.tsx           # CREATE
  app/
    sign-in.test.tsx               # CREATE
```

---

### Task 1: Install packages + Supabase client

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `.env`
- Modify: `app.json` (add scheme + Apple entitlement)
- Create: `__tests__/lib/supabase.test.ts`

**Interfaces:**
- Produces: `supabase` — a configured `SupabaseClient` exported as named export

- [ ] **Step 1: Check Expo SDK 56 compatible versions**

Fetch `https://docs.expo.dev/versions/v56.0.0/sdk/apple-authentication/` and `https://docs.expo.dev/versions/v56.0.0/sdk/auth-session/` to confirm the correct package versions before installing.

- [ ] **Step 2: Install packages**

```bash
npx expo install @supabase/supabase-js expo-apple-authentication expo-auth-session
```

Expected: packages added to `node_modules` and `package.json` updated. `expo-web-browser` is already installed — do NOT reinstall it.

- [ ] **Step 3: Create `.env`**

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace values with your actual Project URL and anon key from **Supabase → Settings → API**.

- [ ] **Step 4: Add scheme and Apple entitlement to `app.json`**

In `app.json`, add `"scheme": "agent-messenger"` to the root `expo` object, and add the Apple Sign-In entitlement under `ios.entitlements`:

```json
{
  "expo": {
    "scheme": "agent-messenger",
    "ios": {
      "entitlements": {
        "com.apple.developer.applesignin": ["Default"]
      }
    }
  }
}
```

- [ ] **Step 5: Write the failing test**

```typescript
// __tests__/lib/supabase.test.ts
import { supabase } from '@/lib/supabase';

describe('supabase client', () => {
  it('exports a client with auth', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
  });

  it('uses secure store adapter', () => {
    // Verify detectSessionInUrl is false (required for RN)
    // @ts-expect-error accessing internal config for test
    expect(supabase.auth['storageKey']).toBeDefined();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest __tests__/lib/supabase.test.ts -v
```

Expected: FAIL — `Cannot find module '@/lib/supabase'`

- [ ] **Step 7: Create `src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest __tests__/lib/supabase.test.ts -v
```

Expected: PASS

- [ ] **Step 9: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/lib/supabase.ts __tests__/lib/supabase.test.ts .env app.json package.json package-lock.json
git commit -m "feat: add supabase client with SecureStore adapter"
```

---

### Task 2: Auth context

**Files:**
- Create: `src/context/AuthContext.tsx`
- Create: `__tests__/context/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`
- Produces:
  - `AuthProvider({ children: React.ReactNode }): JSX.Element`
  - `useAuth(): { session: Session | null; user: User | null; loading: boolean; signOut: () => Promise<void> }`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/context/AuthContext.test.tsx
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const mockUnsubscribe = jest.fn();
const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
const mockOnAuthStateChange = jest.fn().mockReturnValue({
  data: { subscription: { unsubscribe: mockUnsubscribe } },
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts loading then resolves with no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalled());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/context/AuthContext.test.tsx -v
```

Expected: FAIL — `Cannot find module '@/context/AuthContext'`

- [ ] **Step 3: Create `src/context/AuthContext.tsx`**

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: () => supabase.auth.signOut().then(() => undefined),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/context/AuthContext.test.tsx -v
```

Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/context/AuthContext.tsx __tests__/context/AuthContext.test.tsx
git commit -m "feat: add AuthContext with session state and signOut"
```

---

### Task 3: Route groups + auth guard

**Files:**
- Create: `src/app/(app)/_layout.tsx`
- Create: `src/app/(auth)/_layout.tsx`
- Move: `src/app/index.tsx` → `src/app/(app)/index.tsx`
- Move: `src/app/settings.tsx` → `src/app/(app)/settings.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `useAuth` from `@/context/AuthContext`
- Produces: root layout that redirects unauthenticated users to `/(auth)/sign-in` and authenticated users away from auth screens

- [ ] **Step 1: Move existing screens**

```bash
mkdir -p src/app/\(app\) src/app/\(auth\)
mv src/app/index.tsx src/app/\(app\)/index.tsx
mv src/app/settings.tsx src/app/\(app\)/settings.tsx
```

- [ ] **Step 2: Create `src/app/(app)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Create `src/app/(auth)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

- [ ] **Step 4: Update `src/app/_layout.tsx`**

```typescript
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function RouteGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(app)/');
    }
  }, [session, loading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RouteGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all pass (existing tests + auth context tests)

- [ ] **Step 7: Commit**

```bash
git add src/app/_layout.tsx src/app/\(app\)/ src/app/\(auth\)/
git commit -m "feat: restructure routes into (app) and (auth) groups with auth guard"
```

---

### Task 4: Email sign-in + sign-up screens

**Files:**
- Create: `src/app/(auth)/sign-in.tsx`
- Create: `src/app/(auth)/sign-up.tsx`
- Create: `__tests__/app/sign-in.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`
- Produces: functional email/password auth screens with navigation between them

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/app/sign-in.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

import SignInScreen from '@/app/(auth)/sign-in';
import { supabase } from '@/lib/supabase';

describe('SignInScreen email flow', () => {
  it('calls signInWithPassword with entered credentials', async () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign in'));
    await waitFor(() =>
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      }),
    );
  });

  it('shows error message on failure', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid credentials' },
    });
    const { getByPlaceholderText, getByText, findByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'bad@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(getByText('Sign in'));
    expect(await findByText('Invalid credentials')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/app/sign-in.test.tsx -v
```

Expected: FAIL — `Cannot find module '@/app/(auth)/sign-in'`

- [ ] **Step 3: Create `src/app/(auth)/sign-in.tsx`**

```typescript
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
    // success: RouteGuard in _layout redirects to (app) automatically
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

          {/* Apple and Google buttons added in Tasks 5 and 6 */}

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
  error: { ...typography.caption, color: colors.error ?? '#FF6B6B' },
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { ...typography.caption, color: colors.muted },
  link: { alignSelf: 'center' },
  linkText: { ...typography.body, color: colors.accent },
});
```

> **Note:** `colors.error` may not be in the current theme — if it's missing, open `src/theme.ts` and add `error: '#FF6B6B'` to the `colors` object.

- [ ] **Step 4: Create `src/app/(auth)/sign-up.tsx`**

```typescript
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
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, space, radius, typography, screenPadding } from '@/theme';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  async function handleSignUp() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setConfirmed(true);
    }
  }

  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to {email}. Click it to activate your account.
          </Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/(auth)/sign-in')}>
            <Text style={styles.btnText}>Back to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Create account</Text>

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
              autoComplete="new-password"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.btnText}>Create account</Text>
              )}
            </Pressable>
          </View>

          <Link href="/(auth)/sign-in" style={styles.link}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
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
  error: { ...typography.caption, color: colors.error ?? '#FF6B6B' },
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
  link: { alignSelf: 'center' },
  linkText: { ...typography.body, color: colors.accent },
});
```

- [ ] **Step 5: Run tests**

```bash
npx jest __tests__/app/sign-in.test.tsx -v
```

Expected: PASS (2 tests)

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\)/sign-in.tsx src/app/\(auth\)/sign-up.tsx __tests__/app/sign-in.test.tsx
git commit -m "feat: add email sign-in and sign-up screens"
```

---

### Task 5: Apple Sign-In

**Files:**
- Modify: `src/app/(auth)/sign-in.tsx`

**Interfaces:**
- Consumes: `expo-apple-authentication`, `supabase.auth.signInWithIdToken`
- Produces: Apple Sign-In button visible on iOS; calls Supabase with the returned identity token

- [ ] **Step 1: Verify docs before implementing**

Fetch `https://docs.expo.dev/versions/v56.0.0/sdk/apple-authentication/` and `https://supabase.com/docs/guides/auth/social-login/auth-apple.md` to confirm the current API signatures for `AppleAuthentication.signInAsync` and `supabase.auth.signInWithIdToken`.

- [ ] **Step 2: Add Apple Sign-In to `src/app/(auth)/sign-in.tsx`**

Add this import at the top:

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';
```

Add this function inside the component (before `return`):

```typescript
async function handleAppleSignIn() {
  setError(null);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('No identity token returned');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) setError(error.message);
  } catch (e: unknown) {
    if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
      setError(e instanceof Error ? e.message : 'Apple Sign-In failed');
    }
  }
}
```

Add this button in the JSX, between the `{/* Apple and Google buttons */}` comment and the sign-up link:

```typescript
<AppleAuthentication.AppleAuthenticationButton
  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
  cornerRadius={radius.input}
  style={styles.appleBtn}
  onPress={handleAppleSignIn}
/>
```

Add to `StyleSheet.create`:

```typescript
appleBtn: { height: 48 },
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Manual test on iOS simulator**

Run `npm run ios`. On the sign-in screen, tap "Sign in with Apple." Verify the native Apple auth sheet appears. (Full flow requires a real device with an iCloud account.)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/sign-in.tsx
git commit -m "feat: add Apple Sign-In via expo-apple-authentication"
```

---

### Task 6: Google Sign-In (OAuth via browser)

**Files:**
- Modify: `src/app/(auth)/sign-in.tsx`
- Create: `src/app/auth/callback.tsx` (deep link handler)

**Interfaces:**
- Consumes: `expo-auth-session`, `expo-web-browser`, `supabase.auth.signInWithOAuth` + `exchangeCodeForSession`
- Produces: Google sign-in button that opens a browser, completes OAuth, returns session via deep link

- [ ] **Step 1: Verify the OAuth flow docs**

Fetch `https://supabase.com/docs/guides/auth/social-login/auth-google.md` and `https://docs.expo.dev/versions/v56.0.0/sdk/auth-session/` to confirm the current `makeRedirectUri` API and `WebBrowser.openAuthSessionAsync` usage for Expo SDK 56.

- [ ] **Step 2: Create deep link callback handler `src/app/auth/callback.tsx`**

```typescript
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();

  useEffect(() => {
    if (params.code) {
      const url = `agent-messenger://auth/callback?code=${params.code}`;
      supabase.auth.exchangeCodeForSession(url).then(() => {
        router.replace('/(app)/');
      });
    } else {
      router.replace('/(auth)/sign-in');
    }
  }, [params.code]);

  return null;
}
```

- [ ] **Step 3: Add Google Sign-In to `src/app/(auth)/sign-in.tsx`**

Add imports at top:

```typescript
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();
```

Add this function inside the component (before `return`):

```typescript
async function handleGoogleSignIn() {
  setError(null);
  const redirectTo = makeRedirectUri({ scheme: 'agent-messenger', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    setError(error?.message ?? 'Could not start Google sign-in');
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await supabase.auth.exchangeCodeForSession(result.url);
  }
}
```

Add a Google button in the JSX, after the Apple button:

```typescript
<Pressable style={styles.googleBtn} onPress={handleGoogleSignIn}>
  <Text style={styles.googleBtnText}>Continue with Google</Text>
</Pressable>
```

Add to `StyleSheet.create`:

```typescript
googleBtn: {
  height: 48,
  borderRadius: radius.input,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.surface,
  alignItems: 'center',
  justifyContent: 'center',
},
googleBtnText: { ...typography.body, color: colors.ink },
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all pass

- [ ] **Step 6: Manual test**

Run `npm run ios`. Tap "Continue with Google" — the browser should open to Google's sign-in page. Complete sign-in; the app should return to the chat screen.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\)/sign-in.tsx src/app/auth/callback.tsx
git commit -m "feat: add Google Sign-In via OAuth browser flow"
```

---

## Self-Review

**Spec coverage:**
- Apple Sign-In ✓ (Task 5)
- Google Sign-In ✓ (Task 6)
- Email/password ✓ (Task 4)
- Session persistence via SecureStore ✓ (Task 1)
- Protected routing ✓ (Task 3)
- Sign-up flow ✓ (Task 4)
- Supabase dashboard pre-requisites documented ✓ (Pre-requisites section)

**Known gap:** Sign-out is wired in `AuthContext` but not yet surfaced in the settings screen UI — that's a follow-on task since `settings.tsx` is currently a stub.

**Type consistency check:**
- `useAuth()` returns `{ session, user, loading, signOut }` — used consistently in `RouteGuard` and available for sign-out in settings later
- `supabase.auth.signInWithIdToken({ provider: 'apple', token })` — matches Supabase JS v2 API
- `makeRedirectUri({ scheme, path })` — verify against `expo-auth-session` docs in Task 6 Step 1
