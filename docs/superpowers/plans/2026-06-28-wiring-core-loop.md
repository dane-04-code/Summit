# Wiring Core Loop (Connect + Live Chat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app work end-to-end against a real Hermes server — add an agent on a Connect screen, then chat with live streaming that persists across restarts.

**Architecture:** The agent backend (`src/agents/`, `src/db/`) is already built and tested. This plan bridges the UI to it. Two pure, unit-tested helpers carry the logic (`connectDirectAgent`, the stream reducer); the screens are thin glue over `useAgents()` (`addAgent / activeAgent / adapterFor / repo`). A no-agent route guard forces Connect when no agent is configured. Live turns use the adapter's existing `/v1/chat/completions` streaming; local SQLite stays the source of truth for history.

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19, expo-router (file-based, typed routes), `@shopify/flash-list`, jest-expo + `@testing-library/react-native`, TypeScript (strict).

## Global Constraints

- **Expo SDK 56** — RN 0.85, React 19. Verify APIs against <https://docs.expo.dev/versions/v56.0.0/> before writing Expo/RN code.
- **Green bar = `npx tsc --noEmit` AND `npm test` both pass.** A task is not done until both are green.
- **Theme tokens only** — import `colors, space, radius, typography, screenPadding` from `@/theme`. Never raw hex or magic numbers in components.
- **React Compiler is ON** — do not hand-add memoization; follow the rules of hooks strictly (all hooks before any early return).
- **Direct transport only** — relay throws today; do not build relay paths.
- **Secrets live only in the Keychain** (`expo-secure-store` via `agents/secrets.ts`); SQLite never holds the API key.
- **Persist the settled message, not every delta** (`docs/AGENTS.md` §7) — mid-stream tokens stay in React state.
- **Path aliases:** `@/*` → `src/*`.

---

### Task 1: Direct-mode connect helper — ✅ DONE (commit on `build/first-pages`)

A pure function that probes a live Hermes with typed credentials and returns the `NewAgentInput` (carrying the capabilities snapshot) + secret, ready for `addAgent`. No network or Keychain in the unit tests — the adapter factory is injected.

**Files:**

- Create: `src/agents/connect.ts`
- Test: `__tests__/agents/connect.test.ts`

**Interfaces:**

- Consumes: `buildAgent` from `src/agents/registry.ts`; `makeAdapter` from `src/agents/adapters/index.ts`; `NewAgentInput`, `AgentCapabilities` from `src/agents/types.ts`; `ConnectionError` from `src/agents/adapters/types.ts`.
- Produces: `connectDirectAgent(input: ConnectInput, deps?: ConnectDeps): Promise<ConnectOutcome>` where `ConnectInput = { name: string; host: string; apiKey: string }` and `ConnectOutcome = { input: NewAgentInput; secret: string }`. Throws `ConnectionError` on failure.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/agents/connect.test.ts
import { connectDirectAgent } from '@/agents/connect';
import { ConnectionError } from '@/agents/adapters/types';
import type { AgentCapabilities } from '@/agents/types';

const caps: AgentCapabilities = {
  framework: 'hermes',
  hasRunApproval: true,
  hasRunStop: true,
  hasStreaming: true,
  hasJobs: false,
  hasSessions: true,
};

// Fake adapter factory — ignores (agent, getSecret) and returns a stub whose
// only used method is testConnection.
function fakeMake(testConnection: () => Promise<AgentCapabilities>) {
  return (() => ({ testConnection })) as unknown as typeof import('@/agents/adapters').makeAdapter;
}

describe('connectDirectAgent', () => {
  it('returns input + secret with the capabilities snapshot on success', async () => {
    const out = await connectDirectAgent(
      { name: 'Home', host: 'agent.example.com:8642', apiKey: 'sk-1' },
      { makeAdapter: fakeMake(async () => caps) },
    );
    expect(out.secret).toBe('sk-1');
    expect(out.input).toMatchObject({
      name: 'Home',
      framework: 'hermes',
      transport: 'direct',
      baseUrl: 'agent.example.com:8642',
      capabilities: caps,
    });
  });

  it('defaults a blank name to "Hermes" and trims the host', async () => {
    const out = await connectDirectAgent(
      { name: '   ', host: '  10.0.0.5:8642  ', apiKey: 'k' },
      { makeAdapter: fakeMake(async () => caps) },
    );
    expect(out.input.name).toBe('Hermes');
    expect(out.input.baseUrl).toBe('10.0.0.5:8642');
  });

  it('propagates a ConnectionError so the screen can show its message', async () => {
    const make = fakeMake(async () => {
      throw new ConnectionError('unauthorized', 'key rejected');
    });
    await expect(
      connectDirectAgent({ name: 'x', host: 'h:8642', apiKey: 'bad' }, { makeAdapter: make }),
    ).rejects.toBeInstanceOf(ConnectionError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/agents/connect.test.ts`
Expected: FAIL — `Cannot find module '@/agents/connect'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/agents/connect.ts
/**
 * Direct-mode connect flow: validate a host + API key against a live Hermes
 * before persisting anything. Pure orchestration over the adapter so it's
 * unit-testable without a network or the Keychain — the Connect screen calls
 * this, then hands the result to `addAgent`. See docs/AGENTS.md §5.
 */

import type { NewAgentInput } from './types';
import { buildAgent } from './registry';
import { makeAdapter as defaultMakeAdapter } from './adapters';

export type ConnectInput = { name: string; host: string; apiKey: string };

/** Validated agent + secret, ready for `addAgent(input, secret)`. */
export type ConnectOutcome = { input: NewAgentInput; secret: string };

export type ConnectDeps = { makeAdapter?: typeof defaultMakeAdapter };

/**
 * Probe a direct-mode Hermes with the typed credentials. Resolves with the
 * `NewAgentInput` (carrying the capabilities snapshot) + secret on success;
 * throws `ConnectionError` (from the adapter) on any failure so the screen can
 * show a specific message.
 */
export async function connectDirectAgent(
  { name, host, apiKey }: ConnectInput,
  deps: ConnectDeps = {},
): Promise<ConnectOutcome> {
  const makeAdapter = deps.makeAdapter ?? defaultMakeAdapter;
  const transient = buildAgent({
    name: name.trim() || 'Hermes',
    framework: 'hermes',
    transport: 'direct',
    baseUrl: host.trim(),
  });
  const adapter = makeAdapter(transient, async () => apiKey);
  const capabilities = await adapter.testConnection();
  return {
    input: {
      name: transient.name,
      framework: 'hermes',
      transport: 'direct',
      baseUrl: transient.baseUrl,
      capabilities,
    },
    secret: apiKey,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/agents/connect.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/agents/connect.ts __tests__/agents/connect.test.ts
git commit -m "feat: add direct-mode connect helper"
```

---

### Task 2: Connect screen + no-agent route guard — ✅ DONE (commit on `build/first-pages`)

The screen that turns a host + API key into a persisted agent, plus the guard that forces it when no agent exists. Design-system faithful, mirroring `sign-up.tsx`.

**Files:**

- Create: `src/app/(app)/connect.tsx`
- Modify: `src/app/(app)/_layout.tsx` (register the `connect` screen + add `AgentGuard`)

**Interfaces:**

- Consumes: `useAgents()` (`addAgent`) from `src/agents/AgentProvider.tsx`; `connectDirectAgent` (Task 1); `ConnectionError` from `src/agents/adapters/types.ts`.
- Produces: route `/(app)/connect`; `AgentGuard` behaviour — when `ready && !activeAgent` and not on `connect`, redirect to `/(app)/connect`.

- [ ] **Step 1: Add the no-agent guard and register the route**

Replace the entire contents of `src/app/(app)/_layout.tsx`:

```tsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAgents } from '@/agents/AgentProvider';

/** Forces the Connect screen when no agent is configured yet. */
function AgentGuard() {
  const { ready, activeAgent } = useAgents();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onConnect = segments[segments.length - 1] === 'connect';
    if (!activeAgent && !onConnect) {
      router.replace('/(app)/connect');
    }
  }, [ready, activeAgent, segments]);

  return null;
}

export default function AppLayout() {
  return (
    <>
      <AgentGuard />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="cron" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
```

- [ ] **Step 2: Create the Connect screen**

```tsx
// src/app/(app)/connect.tsx
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
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run the full test suite (no regressions)**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 5: Manual verification against live Hermes**

Start the app (`npm start`), sign in. Expected: with no agent configured you are redirected to **Connect**. Enter your live Hermes host + key → **Connect** → you land on the chat screen. Force-quit and reopen → still on chat (agent persisted), not bounced to Connect. Enter a wrong key → inline "the API key was rejected" message; an unreachable host → "Couldn't reach …".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/connect.tsx" "src/app/(app)/_layout.tsx"
git commit -m "feat: add Connect screen and no-agent route guard"
```

---

### Task 3: Live-turn stream reducer — ✅ DONE (commit on `build/first-pages`)

A pure fold from normalized `StreamEvent`s into the in-flight agent turn, plus the helper that renders a turn as message blocks. This is the unit-tested heart of the chat wiring.

**Files:**

- Create: `src/ui/chat/streamReducer.ts`
- Test: `__tests__/chat/streamReducer.test.ts`

**Interfaces:**

- Consumes: `StreamEvent` from `src/agents/adapters/types.ts`; `AgentBlock` from `src/ui/chat/types.ts`.
- Produces: `initialTurn: LiveTurn`; `reduceTurn(turn: LiveTurn, event: StreamEvent): LiveTurn`; `turnToBlocks(turn: LiveTurn): AgentBlock[]`. `LiveTurn = { text: string; toolLabel: string | null; status: 'running' | 'idle' | 'error'; error: string | null; done: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/chat/streamReducer.test.ts
import { initialTurn, reduceTurn, turnToBlocks } from '@/ui/chat/streamReducer';

describe('reduceTurn', () => {
  it('accumulates delta text and stays running', () => {
    let t = initialTurn;
    t = reduceTurn(t, { type: 'delta', text: 'Hel' });
    t = reduceTurn(t, { type: 'delta', text: 'lo' });
    expect(t.text).toBe('Hello');
    expect(t.status).toBe('running');
    expect(t.done).toBe(false);
  });

  it('records the latest tool label', () => {
    const t = reduceTurn(initialTurn, { type: 'tool', label: 'searching the web…' });
    expect(t.toolLabel).toBe('searching the web…');
  });

  it('marks the turn done on done', () => {
    const t = reduceTurn(initialTurn, { type: 'done' });
    expect(t).toMatchObject({ status: 'idle', done: true });
  });

  it('captures the error message and finishes on error', () => {
    const t = reduceTurn(initialTurn, { type: 'error', message: 'dropped' });
    expect(t).toMatchObject({ status: 'error', error: 'dropped', done: true });
  });
});

describe('turnToBlocks', () => {
  it('wraps accumulated text in a single markdown block', () => {
    const t = reduceTurn(initialTurn, { type: 'delta', text: '# Hi' });
    expect(turnToBlocks(t)).toEqual([{ kind: 'markdown', source: '# Hi' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/chat/streamReducer.test.ts`
Expected: FAIL — `Cannot find module '@/ui/chat/streamReducer'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/ui/chat/streamReducer.ts
/**
 * Fold a stream of normalized adapter events into the live agent turn. Pure and
 * synchronous so the accumulation logic is unit-tested without rendering or a
 * network. The chat screen holds a `LiveTurn` per in-flight reply and renders
 * `turnToBlocks(turn)` after each event. Persist the settled turn once `done`
 * (docs/AGENTS.md §7) — never the deltas.
 */

import type { StreamEvent } from '@/agents/adapters/types';
import type { AgentBlock } from './types';

export type LiveTurn = {
  text: string;
  toolLabel: string | null;
  status: 'running' | 'idle' | 'error';
  error: string | null;
  done: boolean;
};

export const initialTurn: LiveTurn = {
  text: '',
  toolLabel: null,
  status: 'running',
  error: null,
  done: false,
};

export function reduceTurn(turn: LiveTurn, event: StreamEvent): LiveTurn {
  switch (event.type) {
    case 'delta':
      return { ...turn, text: turn.text + event.text };
    case 'tool':
      return { ...turn, toolLabel: event.label };
    case 'done':
      return { ...turn, status: 'idle', done: true };
    case 'error':
      return { ...turn, status: 'error', error: event.message, done: true };
    default:
      return turn;
  }
}

/** The agent message body for a turn: a single markdown block of accumulated text. */
export function turnToBlocks(turn: LiveTurn): AgentBlock[] {
  return [{ kind: 'markdown', source: turn.text }];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/chat/streamReducer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/ui/chat/streamReducer.ts __tests__/chat/streamReducer.test.ts
git commit -m "feat: add live-turn stream reducer"
```

---

### Task 4: Wire the chat screen to the active agent — ✅ DONE (commit on `build/first-pages`)

Replace the seeded thread + fake interval in the chat screen with real session loading, live streaming via the adapter, and message persistence. The sidebar stays on seed data for now (Slice 2 wires it).

**Files:**

- Modify: `src/app/(app)/index.tsx`

**Interfaces:**

- Consumes: `useAgents()` (`activeAgent`, `adapterFor`, `repo`) from `src/agents/AgentProvider.tsx`; `initialTurn`, `reduceTurn`, `turnToBlocks` from `src/ui/chat/streamReducer.ts`; `repo` methods `listSessions / listMessages / upsertSession / appendMessage`; `ChatSession`, `StoredMessage` from `src/agents/types.ts`; `Message` from `src/ui/chat/types.ts`.
- Produces: a working chat screen — no new exports.

- [ ] **Step 1: Replace the stub header block and imports**

In `src/app/(app)/index.tsx`, change the imports near the top: add the agent hook, the reducer, and the persistence types; drop `SEED_THREAD` from the seed import (keep `RECENT_CHATS`, `ACTIVE_CHAT_ID`, `ACCOUNT` for the sidebar).

Replace this line:

```tsx
import { SEED_THREAD, RECENT_CHATS, ACTIVE_CHAT_ID, ACCOUNT } from '@/ui/chat/seed';
import type { Message, AgentBlock, RunState, MarkdownFile } from '@/ui/chat/types';
```

with:

```tsx
import { RECENT_CHATS, ACTIVE_CHAT_ID, ACCOUNT } from '@/ui/chat/seed';
import type { Message, AgentBlock, RunState, MarkdownFile } from '@/ui/chat/types';
import { useAgents } from '@/agents/AgentProvider';
import { initialTurn, reduceTurn, turnToBlocks } from '@/ui/chat/streamReducer';
import type { ChatSession } from '@/agents/types';
```

Then delete the now-unused stub constants (the `STUB_WORDS` and `STREAM_INTERVAL_MS` block under the "Stub streaming data" comment). Keep `AGENT_NAME`, `RUNNING_HINT`, `genId`, and `agentText`.

- [ ] **Step 2: Swap seeded state for live state**

Inside `AgentScreen`, replace the messages init and add the agent hook + a session ref. Change:

```tsx
  const [messages, setMessages] = useState<Message[]>(SEED_THREAD);
```

to:

```tsx
  const { activeAgent, adapterFor, repo } = useAgents();
  const [messages, setMessages] = useState<Message[]>([]);
  const sessionRef = useRef<ChatSession | null>(null);
```

Remove the now-unused `streamIntervalRef` declaration and the unmount-cleanup effect that clears it (the async stream loop replaces the interval). Add a `cancelledRef` for unmount safety near the other refs:

```tsx
  const cancelledRef = useRef(false);
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);
```

- [ ] **Step 3: Load the latest session on mount**

Add this effect alongside the other effects in `AgentScreen`:

```tsx
  // Restore the most recent thread for the active agent (docs/AGENTS.md §6).
  useEffect(() => {
    if (!activeAgent) return;
    let cancelled = false;
    (async () => {
      const sessions = await repo.listSessions(activeAgent.id); // newest-first
      const latest = sessions[0] ?? null;
      if (!latest || cancelled) return;
      const stored = await repo.listMessages(latest.id); // oldest-first
      if (cancelled) return;
      sessionRef.current = latest;
      setMessages(stored.map((s) => s.message));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAgent, repo]);
```

- [ ] **Step 4: Add session creation + rewrite send to stream live**

Add an `ensureSession` helper and replace the entire stubbed `handleSend` callback:

```tsx
  const ensureSession = useCallback(async (): Promise<ChatSession> => {
    if (sessionRef.current) return sessionRef.current;
    const now = Date.now();
    const session: ChatSession = {
      id: genId(),
      agentId: activeAgent!.id,
      title: null,
      remoteSessionKey: genId(), // stable channel identity for X-Hermes-Session-Key
      createdAt: now,
      updatedAt: now,
    };
    await repo.upsertSession(session);
    sessionRef.current = session;
    return session;
  }, [activeAgent, repo]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !activeAgent) return;
    setInput('');

    const session = await ensureSession();
    const now = Date.now();
    const userMsg: Message = { id: genId(), role: 'user', text };
    await repo.appendMessage({ id: userMsg.id, sessionId: session.id, message: userMsg, createdAt: now });

    const agentId = genId();
    setMessages((prev) => [...prev, userMsg, { id: agentId, role: 'agent', blocks: [{ kind: 'markdown', source: '' }] }]);
    setStreaming(true);
    setStatus('running');

    let turn = initialTurn;
    try {
      const stream = adapterFor(activeAgent).sendMessage(text, {
        sessionId: session.id,
        sessionKey: session.remoteSessionKey ?? undefined,
      });
      for await (const event of stream) {
        turn = reduceTurn(turn, event);
        if (cancelledRef.current) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === agentId ? { id: agentId, role: 'agent', blocks: turnToBlocks(turn) } : m)),
        );
        if (turn.done) break;
      }
    } catch {
      turn = { ...turn, status: 'error', error: 'The connection to the agent dropped.', done: true };
    }

    if (cancelledRef.current) return;
    setStreaming(false);

    if (turn.status === 'error') {
      setStatus('error');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentId
            ? { id: agentId, role: 'agent', blocks: [{ kind: 'text', spans: [{ text: turn.error ?? 'Something went wrong.' }], tone: 'muted' }] }
            : m,
        ),
      );
      return;
    }

    setStatus('idle');
    const settled: Message = { id: agentId, role: 'agent', blocks: turnToBlocks(turn) };
    await repo.appendMessage({ id: agentId, sessionId: session.id, message: settled, createdAt: Date.now() });
    await repo.upsertSession({
      ...session,
      title: session.title ?? text.slice(0, 40),
      updatedAt: Date.now(),
    });
    sessionRef.current = { ...session, title: session.title ?? text.slice(0, 40), updatedAt: Date.now() };
  }, [input, streaming, activeAgent, adapterFor, repo, ensureSession]);
```

- [ ] **Step 5: Reset the session on New chat**

In `handleNewChat`, remove the `streamIntervalRef` clearing (the ref is gone) and clear the session ref so the next send starts a fresh thread. The body becomes:

```tsx
  const handleNewChat = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    sessionRef.current = null;
    setMessages([]);
    setInput('');
    setStreaming(false);
    setStatus('idle');
    setSidebarOpen(false);
  }, []);
```

- [ ] **Step 6: Typecheck and remove any dead references**

Run: `npx tsc --noEmit`
Expected: clean. If `tsc` flags an unused `RunState`/`AgentBlock` import or the removed `streamIntervalRef`, delete the offending leftover. The `onSubmitEditing={handleSend}` prop on the composer `TextInput` now points at an async function — that is fine (its returned promise is ignored).

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all suites pass (the screen has no unit test; its logic is covered by Task 3's reducer tests and verified live below).

- [ ] **Step 8: Manual verification against live Hermes**

Start the app, ensure an agent is connected (Task 2). Send "hello" → the reply streams token-by-token into a markdown block; a tool step (if any) shows in the header hint. Force-quit and reopen → the conversation is restored. Tap **New chat** → thread clears; sending starts a fresh session. Disconnect the server and send → the agent message is replaced by a muted error line and the header shows the error state.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/index.tsx"
git commit -m "feat: wire chat screen to live agent streaming and persistence"
```

---

## Self-Review

**1. Spec coverage (Slices 0–1 of the design):**

- Connect screen + direct-mode test-before-save → Task 1 (`connectDirectAgent`) + Task 2 (screen). ✓
- No-agent gate (`ready && !activeAgent` → Connect) → Task 2 (`AgentGuard`). ✓
- Typed `ConnectionError` messages → surfaced in Task 2's `handleConnect`; mapping lives in the adapter (`hermes.ts`). ✓
- Live chat: load session, stream deltas into a markdown block, persist settled message, status from events, error handling → Tasks 3–4. ✓
- Persist settled message not deltas (`docs/AGENTS.md` §7) → Task 4 Step 4 (persist on `done` only). ✓
- Session continuity headers (`sessionId`/`sessionKey`) → Task 4 Step 4 (`sendMessage` opts). ✓
- Sidebar history, account, approvals, settings, cron → **out of scope here** (Slices 2–5, their own plans). Stated in the plan intro.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step shows complete code; every command shows expected output. ✓

**3. Type consistency:** `connectDirectAgent`/`ConnectInput`/`ConnectOutcome` identical across Tasks 1–2. `LiveTurn`/`reduceTurn`/`turnToBlocks`/`initialTurn` identical across Tasks 3–4. `ChatSession`, `StoredMessage`, `Message`, `NewAgentInput`, `AgentCapabilities`, `StreamEvent` all match their real definitions in `src/agents/types.ts`, `src/agents/adapters/types.ts`, and `src/ui/chat/types.ts`. `repo` method names (`listSessions`, `listMessages`, `upsertSession`, `appendMessage`) match `src/db/repository.ts`. `useAgents()` fields (`addAgent`, `activeAgent`, `adapterFor`, `repo`, `ready`) match `AgentProvider.tsx`. ✓

---

## Notes for the next plans (Slices 2–5, not in scope here)

- **Slice 2 (sidebar history + account):** map `repo.listSessions` → `ChatGroup[]`, account from `useAuth()`, replace the seed props still passed to `<Sidebar>` in `index.tsx`.
- **Slice 3 (approvals + stop):** extend `StreamEvent` with `run`/`approval` variants, add the Runs-API `sendMessage` path in `hermes.ts` gated on capabilities, extend `reduceTurn` for the new variants, wire `ApprovalCard` + composer Stop. **Confirm the `/v1/runs/{id}/events` approval payload against live Hermes first.**
- **Slice 4 (settings):** real account/agent, `signOut`, `removeAgent`.
- **Slice 5 (cron):** add adapter job methods over `/api/jobs`, map to `CronJob`, probe availability (not in `/v1/capabilities`).
