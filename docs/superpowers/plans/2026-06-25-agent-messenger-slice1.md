# Agent Messenger — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a React Native (Expo) app that connects to a self-hosted Hermes Agent and provides a chat client with proper streaming-markdown rendering and a live status pill — running on a physical iPhone via Expo Go.

**Architecture:** Agnostic UI fed by a thin, plain `hermes.ts` transport module (no adapter interface in v1). Pure logic (storage, transport, SSE parsing, markdown stabilization) is built first and unit-tested with no device; screens are built last and verified by eye on the phone.

**Tech Stack:** Expo (React Native, New Architecture), Expo Router, TypeScript (strict), `react-native-sse`, `react-native-markdown-display`, `expo-secure-store`, `@shopify/flash-list`, `jest-expo` + `@testing-library/react-native`.

## Global Constraints

- **Runtime target:** Expo Go on a physical iPhone (QR/dev server). No custom native code this slice.
- **Language:** TypeScript, `strict: true`. No `any` in committed code.
- **Hermes auth:** `Authorization: Bearer <apiKey>` on every request. Default port `8642`.
- **Chat is stateless:** full `messages` array sent each request; client holds the transcript in memory.
- **Session headers on every chat request:** `X-Hermes-Session-Id` and `X-Hermes-Session-Key`.
- **SSE events handled:** `chat.completion.chunk` (token deltas), `hermes.tool.progress` (tool chips), `[DONE]` sentinel.
- **No `AgentAdapter` interface.** Plain functions in `hermes.ts`. (Interface extracted in v2 from two real cases.)
- **TDD:** logic tasks (1–4) write the failing test first. UI tasks (5–8) ship with a manual verification checklist.
- **Commit after every green step.**

---

### Task 0: Scaffold the app and test runner

**Files:**
- Create: project via `create-expo-app` (TypeScript template, Expo Router)
- Create: `jest.config.js`, `jest-setup.ts`
- Modify: `package.json` (scripts, jest preset)
- Create: `app/index.tsx` (placeholder), `tsconfig.json` (strict)

**Interfaces:**
- Produces: a booting Expo Router app and a working `npm test` command for all later tasks.

- [ ] **Step 1: Create the app**

```bash
npx create-expo-app@latest agent-messenger --template
# choose: "Navigation (TypeScript)" / Expo Router tabs template
cd agent-messenger
```

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npx expo install react-native-sse react-native-markdown-display expo-secure-store @shopify/flash-list
npm install -D jest-expo jest @testing-library/react-native @types/jest
```

- [ ] **Step 3: Configure Jest**

`package.json` — add:
```json
{
  "scripts": { "test": "jest", "test:watch": "jest --watch" },
  "jest": { "preset": "jest-expo", "setupFilesAfterEnv": ["<rootDir>/jest-setup.ts"] }
}
```

`jest-setup.ts`:
```ts
import '@testing-library/react-native/extend-expect';
```

- [ ] **Step 4: Set TypeScript strict**

`tsconfig.json` — ensure `"strict": true` under `compilerOptions`.

- [ ] **Step 5: Add a smoke test to prove the runner works**

`__tests__/smoke.test.ts`:
```ts
test('test runner works', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Run the test**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Verify the app boots on the iPhone**

Run: `npx expo start`
Scan the QR with Expo Go. Expected: default template screen renders.

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold expo app + jest runner"
```

---

### Task 1: `storage.ts` — secure credential storage

**Files:**
- Create: `src/storage.ts`
- Test: `src/__tests__/storage.test.ts`

**Interfaces:**
- Produces:
  - `normalizeHost(input: string): string` — adds `https://` if no scheme, strips trailing slash.
  - `saveCredentials(creds: Credentials): Promise<void>`
  - `loadCredentials(): Promise<Credentials | null>`
  - `clearCredentials(): Promise<void>`
  - `type Credentials = { host: string; apiKey: string }`

- [ ] **Step 1: Write the failing test**

`src/__tests__/storage.test.ts`:
```ts
import { normalizeHost } from '../storage';

describe('normalizeHost', () => {
  it('adds https:// when no scheme is present', () => {
    expect(normalizeHost('my-hermes.home:8642')).toBe('https://my-hermes.home:8642');
  });
  it('preserves an explicit http scheme', () => {
    expect(normalizeHost('http://10.0.0.5:8642')).toBe('http://10.0.0.5:8642');
  });
  it('strips a trailing slash', () => {
    expect(normalizeHost('https://h.example.com/')).toBe('https://h.example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- storage`
Expected: FAIL — cannot find module `../storage`.

- [ ] **Step 3: Implement `normalizeHost`**

`src/storage.ts`:
```ts
import * as SecureStore from 'expo-secure-store';

export type Credentials = { host: string; apiKey: string };

const KEY = 'agent-messenger-credentials';

export function normalizeHost(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(creds));
}

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Credentials) : null;
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- storage`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add save/load round-trip test with mocked SecureStore**

Append to `src/__tests__/storage.test.ts`:
```ts
import { saveCredentials, loadCredentials } from '../storage';

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    getItemAsync: jest.fn(async (k: string) => store[k] ?? null),
    deleteItemAsync: jest.fn(async (k: string) => { delete store[k]; }),
  };
});

it('round-trips credentials', async () => {
  await saveCredentials({ host: 'https://h:8642', apiKey: 'secret' });
  expect(await loadCredentials()).toEqual({ host: 'https://h:8642', apiKey: 'secret' });
});
```

- [ ] **Step 6: Run tests**

Run: `npm test -- storage`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add src/storage.ts src/__tests__/storage.test.ts
git commit -m "feat: secure credential storage with host normalization"
```

---

### Task 2: `hermes.ts` — connect + capabilities

**Files:**
- Create: `src/hermes.ts`
- Test: `src/__tests__/hermes-connect.test.ts`

**Interfaces:**
- Consumes: `Credentials` from `storage.ts`.
- Produces:
  - `type Capabilities = { platform: string; features: Record<string, boolean> }`
  - `buildHeaders(apiKey: string, session?: Session): Record<string, string>`
  - `type Session = { id: string; key: string }`
  - `getCapabilities(host: string, apiKey: string): Promise<Capabilities>`
  - `getHealth(host: string, apiKey: string): Promise<boolean>`
  - `connect(host: string, apiKey: string): Promise<ConnectResult>` — classifies failures.
  - `type ConnectResult = { ok: true; capabilities: Capabilities } | { ok: false; reason: 'unreachable' | 'unauthorized' | 'not-hermes' }`

- [ ] **Step 1: Write the failing test**

`src/__tests__/hermes-connect.test.ts`:
```ts
import { buildHeaders, getCapabilities, connect } from '../hermes';

describe('buildHeaders', () => {
  it('always includes the bearer token', () => {
    expect(buildHeaders('secret')['Authorization']).toBe('Bearer secret');
  });
  it('adds session headers when a session is given', () => {
    const h = buildHeaders('secret', { id: 'sid', key: 'skey' });
    expect(h['X-Hermes-Session-Id']).toBe('sid');
    expect(h['X-Hermes-Session-Key']).toBe('skey');
  });
});

describe('getCapabilities', () => {
  it('GETs /v1/capabilities and returns the parsed body', async () => {
    const body = { platform: 'hermes-agent', features: { chat_completions: true, run_approval: true } };
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
    const caps = await getCapabilities('https://h:8642', 'secret');
    expect(caps.features.run_approval).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://h:8642/v1/capabilities');
  });
});

describe('connect (classifies the outcome)', () => {
  it('returns ok with capabilities on success', async () => {
    const body = { platform: 'hermes-agent', features: {} };
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
    const r = await connect('https://h:8642', 'secret');
    expect(r).toEqual({ ok: true, capabilities: body });
  });
  it('returns unreachable when fetch throws', async () => {
    global.fetch = jest.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    expect(await connect('https://h:8642', 'k')).toEqual({ ok: false, reason: 'unreachable' });
  });
  it('returns unauthorized on 401', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    expect(await connect('https://h:8642', 'k')).toEqual({ ok: false, reason: 'unauthorized' });
  });
  it('returns not-hermes when the body lacks a platform', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await connect('https://h:8642', 'k')).toEqual({ ok: false, reason: 'not-hermes' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- hermes-connect`
Expected: FAIL — cannot find module `../hermes`.

- [ ] **Step 3: Implement**

`src/hermes.ts`:
```ts
export type Session = { id: string; key: string };
export type Capabilities = { platform: string; features: Record<string, boolean> };

export function buildHeaders(apiKey: string, session?: Session): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (session) {
    headers['X-Hermes-Session-Id'] = session.id;
    headers['X-Hermes-Session-Key'] = session.key;
  }
  return headers;
}

export async function getCapabilities(host: string, apiKey: string): Promise<Capabilities> {
  const res = await fetch(`${host}/v1/capabilities`, { headers: buildHeaders(apiKey) });
  if (!res.ok) throw new Error(`Capabilities request failed: ${res.status}`);
  return (await res.json()) as Capabilities;
}

export async function getHealth(host: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${host}/health`, { headers: buildHeaders(apiKey) });
    return res.ok;
  } catch {
    return false;
  }
}

export type ConnectResult =
  | { ok: true; capabilities: Capabilities }
  | { ok: false; reason: 'unreachable' | 'unauthorized' | 'not-hermes' };

export async function connect(host: string, apiKey: string): Promise<ConnectResult> {
  let res: Response;
  try {
    res = await fetch(`${host}/v1/capabilities`, { headers: buildHeaders(apiKey) });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' };
  if (!res.ok) return { ok: false, reason: 'not-hermes' };
  try {
    const caps = (await res.json()) as Capabilities;
    return caps.platform ? { ok: true, capabilities: caps } : { ok: false, reason: 'not-hermes' };
  } catch {
    return { ok: false, reason: 'not-hermes' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- hermes-connect`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hermes.ts src/__tests__/hermes-connect.test.ts
git commit -m "feat: hermes connect, capabilities, health"
```

---

### Task 3: `hermes.ts` — SSE chunk parsing + chat stream

**Files:**
- Modify: `src/hermes.ts`
- Create: `src/__tests__/hermes-stream.test.ts`
- Create: `src/__tests__/fixtures/sse-chunks.ts` (hand-written from FRAMEWORKS.md shapes)

**Interfaces:**
- Produces:
  - `type StreamEvent = { type: 'token'; text: string } | { type: 'tool'; label: string } | { type: 'done' }`
  - `parseChunk(data: string): StreamEvent | null` — classifies one SSE `data:` payload.
  - `sendMessage(args: SendArgs): AsyncIterable<StreamEvent>`
  - `type SendArgs = { host: string; apiKey: string; messages: ChatMessage[]; session: Session }`
  - `type ChatMessage = { role: 'user' | 'assistant'; content: string }`

- [ ] **Step 1: Write fixtures from documented shapes**

`src/__tests__/fixtures/sse-chunks.ts`:
```ts
// Shapes copied from FRAMEWORKS.md (Hermes SSE event types).
export const tokenChunk =
  JSON.stringify({ object: 'chat.completion.chunk', choices: [{ delta: { content: 'Hello' } }] });
export const emptyDeltaChunk =
  JSON.stringify({ object: 'chat.completion.chunk', choices: [{ delta: {} }] });
export const toolProgress =
  JSON.stringify({ object: 'hermes.tool.progress', tool: 'web_search', label: 'Searching the web' });
export const doneSentinel = '[DONE]';
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/hermes-stream.test.ts`:
```ts
import { parseChunk } from '../hermes';
import { tokenChunk, emptyDeltaChunk, toolProgress, doneSentinel } from './fixtures/sse-chunks';

describe('parseChunk', () => {
  it('extracts a token delta', () => {
    expect(parseChunk(tokenChunk)).toEqual({ type: 'token', text: 'Hello' });
  });
  it('ignores an empty delta', () => {
    expect(parseChunk(emptyDeltaChunk)).toBeNull();
  });
  it('maps a tool progress event to a tool chip', () => {
    expect(parseChunk(toolProgress)).toEqual({ type: 'tool', label: 'Searching the web' });
  });
  it('recognizes the [DONE] sentinel', () => {
    expect(parseChunk(doneSentinel)).toEqual({ type: 'done' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- hermes-stream`
Expected: FAIL — `parseChunk` is not a function.

- [ ] **Step 4: Implement `parseChunk`**

Add to `src/hermes.ts`:
```ts
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'done' };

type RawChunk = {
  object?: string;
  label?: string;
  tool?: string;
  choices?: { delta?: { content?: string } }[];
};

export function parseChunk(data: string): StreamEvent | null {
  if (data.trim() === '[DONE]') return { type: 'done' };
  let parsed: RawChunk;
  try { parsed = JSON.parse(data) as RawChunk; } catch { return null; }
  if (parsed.object === 'hermes.tool.progress') {
    return { type: 'tool', label: parsed.label ?? parsed.tool ?? 'Working' };
  }
  const text = parsed.choices?.[0]?.delta?.content;
  return text ? { type: 'token', text } : null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- hermes-stream`
Expected: PASS, 4 tests.

- [ ] **Step 6: Implement `sendMessage` (streaming wrapper)**

Add to `src/hermes.ts`:
```ts
import EventSource from 'react-native-sse';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type SendArgs = {
  host: string; apiKey: string; messages: ChatMessage[]; session: Session;
};

export async function* sendMessage(args: SendArgs): AsyncIterable<StreamEvent> {
  const queue: StreamEvent[] = [];
  let resolve: (() => void) | null = null;
  let finished = false;

  const push = (e: StreamEvent) => { queue.push(e); resolve?.(); resolve = null; };

  const es = new EventSource(`${args.host}/v1/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(args.apiKey, args.session),
    body: JSON.stringify({ model: 'hermes-agent', messages: args.messages, stream: true }),
  });

  es.addEventListener('message', (ev) => {
    if (ev.data == null) return;
    const event = parseChunk(ev.data);
    if (event) push(event);
    if (event?.type === 'done') { finished = true; es.close(); resolve?.(); }
  });
  es.addEventListener('error', () => { finished = true; es.close(); resolve?.(); });

  while (!finished || queue.length) {
    if (!queue.length) await new Promise<void>((r) => (resolve = r));
    while (queue.length) yield queue.shift() as StreamEvent;
  }
}
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS (parsing tests green; `sendMessage` covered by manual smoke in Task 8).

- [ ] **Step 8: Commit**

```bash
git add src/hermes.ts src/__tests__/hermes-stream.test.ts src/__tests__/fixtures/sse-chunks.ts
git commit -m "feat: SSE chunk parsing + streaming sendMessage"
```

---

### Task 4: `markdown/stabilize.ts` — streaming stabilization buffer

**Files:**
- Create: `src/markdown/stabilize.ts`
- Test: `src/markdown/__tests__/stabilize.test.ts`

**Interfaces:**
- Produces: `stabilize(text: string): { stable: string; tail: string }` — `stable` is safe to render as markdown now; `tail` is held as plain text until syntactically complete.

- [ ] **Step 1: Write the failing test**

`src/markdown/__tests__/stabilize.test.ts`:
```ts
import { stabilize } from '../stabilize';

describe('stabilize', () => {
  it('passes through complete markdown unchanged', () => {
    const t = '# Title\n\nSome **bold** text.\n';
    expect(stabilize(t)).toEqual({ stable: t, tail: '' });
  });

  it('holds an unclosed code fence in the tail', () => {
    const t = 'Here is code:\n```js\nconst x = 1;';
    const { stable, tail } = stabilize(t);
    expect(stable).toBe('Here is code:\n');
    expect(tail).toBe('```js\nconst x = 1;');
  });

  it('releases the fence once it closes', () => {
    const t = 'Here:\n```js\nconst x = 1;\n```\n';
    expect(stabilize(t)).toEqual({ stable: t, tail: '' });
  });

  it('holds a partial trailing table row in the tail', () => {
    const t = '| a | b |\n| - | - |\n| 1 |';
    const { tail } = stabilize(t);
    expect(tail).toBe('| 1 |');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stabilize`
Expected: FAIL — cannot find module `../stabilize`.

- [ ] **Step 3: Implement `stabilize`**

`src/markdown/stabilize.ts`:
```ts
export function stabilize(text: string): { stable: string; tail: string } {
  // 1. Unclosed code fence: odd number of ``` markers -> hold from the last fence.
  const fenceMatches = [...text.matchAll(/^```/gm)];
  if (fenceMatches.length % 2 === 1) {
    const lastFence = fenceMatches[fenceMatches.length - 1].index ?? 0;
    return { stable: text.slice(0, lastFence), tail: text.slice(lastFence) };
  }
  // 2. Partial trailing table row: a final line that looks like a table row but
  //    has no terminating newline yet.
  if (!text.endsWith('\n')) {
    const lastNl = text.lastIndexOf('\n');
    const lastLine = text.slice(lastNl + 1);
    if (/^\s*\|.*\|?\s*$/.test(lastLine) && lastLine.includes('|')) {
      return { stable: text.slice(0, lastNl + 1), tail: lastLine };
    }
  }
  return { stable: text, tail: '' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- stabilize`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/markdown/stabilize.ts src/markdown/__tests__/stabilize.test.ts
git commit -m "feat: streaming markdown stabilization buffer"
```

---

### Task 5: `StreamingMarkdown` render component

**Files:**
- Create: `src/markdown/StreamingMarkdown.tsx`

**Interfaces:**
- Consumes: `stabilize` from `stabilize.ts`.
- Produces: `<StreamingMarkdown text={string} streaming={boolean} />` — renders `stable` as markdown; while `streaming`, appends `tail` as plain monospace text.

- [ ] **Step 1: Implement the component**

`src/markdown/StreamingMarkdown.tsx`:
```tsx
import React, { useMemo } from 'react';
import { Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { stabilize } from './stabilize';

export function StreamingMarkdown({ text, streaming }: { text: string; streaming: boolean }) {
  const { stable, tail } = useMemo(
    () => (streaming ? stabilize(text) : { stable: text, tail: '' }),
    [text, streaming],
  );
  return (
    <>
      <Markdown>{stable}</Markdown>
      {tail ? <Text style={{ fontFamily: 'Courier', opacity: 0.8 }}>{tail}</Text> : null}
    </>
  );
}
```

- [ ] **Step 2: Manual verification (on iPhone via Expo Go)**

Temporarily render in `app/index.tsx` with a hardcoded streaming string that grows on a timer (paste a markdown sample with a code block + table). Confirm: headings/tables/code render; an unclosed fence shows as plain text then snaps into a code block when closed. Revert the temporary code.

- [ ] **Step 3: Commit**

```bash
git add src/markdown/StreamingMarkdown.tsx
git commit -m "feat: streaming markdown render component"
```

---

### Task 6: Connect screen

**Files:**
- Modify: `app/index.tsx`

**Interfaces:**
- Consumes: `normalizeHost`, `saveCredentials` (storage), `connect` (hermes), `router` (expo-router).

- [ ] **Step 1: Implement the Connect screen**

`app/index.tsx`:
```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { normalizeHost, saveCredentials } from '../src/storage';
import { connect, type ConnectResult } from '../src/hermes';

function messageFor(result: Extract<ConnectResult, { ok: false }>, host: string): string {
  switch (result.reason) {
    case 'unreachable': return `Couldn't reach ${host}. Is the API server running? (hermes gateway)`;
    case 'unauthorized': return "Server's there, but the API key was rejected.";
    case 'not-hermes': return "Reached something, but it doesn't look like Hermes. Check host/port.";
  }
}

export default function Connect() {
  const [host, setHost] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  async function testAndContinue() {
    setBusy(true);
    setStatus('Connecting…');
    const normalized = normalizeHost(host);
    const result = await connect(normalized, apiKey);
    if (result.ok) {
      await saveCredentials({ host: normalized, apiKey });
      router.replace('/agent');
    } else {
      setStatus(messageFor(result, normalized));
    }
    setBusy(false);
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Connect your agent</Text>
      <TextInput placeholder="host e.g. my-hermes.home:8642" autoCapitalize="none" autoCorrect={false}
        value={host} onChangeText={setHost} style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <TextInput placeholder="API key" secureTextEntry value={apiKey} onChangeText={setApiKey}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />

      <Pressable onPress={() => setShowHelp((s) => !s)}>
        <Text style={{ color: '#2563eb' }}>{showHelp ? '▾' : '▸'} Where do I find these?</Text>
      </Pressable>
      {showHelp ? (
        <Text style={{ fontFamily: 'Courier', fontSize: 12, backgroundColor: '#f3f4f6', padding: 10, borderRadius: 8 }}>
          {`In ~/.hermes/.env:\n  API_SERVER_ENABLED=true\n  API_SERVER_KEY=your-secret-key\n  API_SERVER_PORT=8642\n\nThen start it:\n  hermes gateway`}
        </Text>
      ) : null}

      <Button title={busy ? 'Connecting…' : 'Test connection'} onPress={testAndContinue} disabled={busy} />
      {status ? <Text>{status}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 2: Manual verification**

Run `npx expo start`, open on iPhone. Tap "Where do I find these?" → setup help expands. Enter your real Hermes host + key, tap Test connection → navigates to the empty agent screen. Then test each failure: wrong port (→ unreachable message), wrong key (→ rejected message).

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "feat: connect screen with capability check"
```

---

### Task 7: Agent screen — chat thread + streaming + status

**Files:**
- Create: `app/agent.tsx`

**Interfaces:**
- Consumes: `loadCredentials` (storage), `sendMessage`, `StreamEvent`, `ChatMessage`, `Session` (hermes), `StreamingMarkdown` (markdown), `FlashList`.

- [ ] **Step 1: Implement the Agent screen**

`app/agent.tsx`:
```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { loadCredentials, type Credentials } from '../src/storage';
import { sendMessage, type ChatMessage, type Session } from '../src/hermes';
import { StreamingMarkdown } from '../src/markdown/StreamingMarkdown';

type UiMessage = ChatMessage & { id: string };
type Status = 'idle' | 'running' | 'error';

export default function Agent() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [toolLabel, setToolLabel] = useState<string | null>(null);
  const session = useRef<Session>({ id: `sess-${Date.now()}`, key: 'agent-messenger' });

  useEffect(() => { loadCredentials().then(setCreds); }, []);

  async function send() {
    if (!creds || !input.trim()) return;
    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: 'user', content: input };
    const assistantId = `a-${Date.now()}`;
    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setStatus('running');
    try {
      for await (const ev of sendMessage({ ...creds, messages: history, session: session.current })) {
        if (ev.type === 'token') {
          setMessages((m) => m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: msg.content + ev.text } : msg));
        } else if (ev.type === 'tool') {
          setToolLabel(ev.label);
        }
      }
      setStatus('idle');
      setToolLabel(null);
    } catch {
      setStatus('error');
      setToolLabel(null);
    }
  }

  const pill = { idle: '#16a34a', running: '#ca8a04', error: '#dc2626' }[status];

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pill }} />
        <Text>{status}</Text>
        {toolLabel ? <Text style={{ opacity: 0.7 }}>· {toolLabel}…</Text> : null}
      </View>
      <FlashList
        data={messages}
        estimatedItemSize={80}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) =>
          item.role === 'user' ? (
            // User: right-aligned bubble (messaging feel)
            <View style={{ alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: '#e7eef7',
              borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, marginVertical: 6 }}>
              <Text>{item.content}</Text>
            </View>
          ) : (
            // Agent: full-width, no bubble — room for tables/code
            <View style={{ paddingVertical: 6 }}>
              <StreamingMarkdown text={item.content} streaming={status === 'running'} />
            </View>
          )
        }
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={input} onChangeText={setInput} placeholder="Message…"
          style={{ flex: 1, borderWidth: 1, borderRadius: 8, padding: 10 }} />
        <Button title="Send" onPress={send} />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Manual verification (the real test of the slice)**

On the iPhone: send "Show me a markdown table and a code block." Expected: tokens stream in; the table and code render correctly; status pill goes running→idle. Send a follow-up; confirm context continuity (same session headers).

- [ ] **Step 3: Commit**

```bash
git add app/agent.tsx
git commit -m "feat: agent chat screen with streaming markdown + status pill"
```

---

### Task 8: Settings + live smoke + fixture confirmation

**Files:**
- Create: `app/settings.tsx`
- Modify: `src/__tests__/fixtures/sse-chunks.ts` (replace hand-written with captured-real if shapes differ)

**Interfaces:**
- Consumes: `loadCredentials`, `clearCredentials`, `saveCredentials` (storage), `getHealth` (hermes).

- [ ] **Step 1: Implement Settings**

`app/settings.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { loadCredentials, saveCredentials, normalizeHost } from '../src/storage';
import { getHealth } from '../src/hermes';

export default function Settings() {
  const [host, setHost] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [health, setHealth] = useState<string | null>(null);

  useEffect(() => {
    loadCredentials().then((c) => { if (c) { setHost(c.host); setApiKey(c.apiKey); } });
  }, []);

  async function retest() {
    const normalized = normalizeHost(host);
    await saveCredentials({ host: normalized, apiKey });
    setHealth((await getHealth(normalized, apiKey)) ? 'Healthy' : 'Unreachable');
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Connection</Text>
      <TextInput value={host} onChangeText={setHost} autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <TextInput value={apiKey} onChangeText={setApiKey} secureTextEntry
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <Button title="Save & retest" onPress={retest} />
      {health ? <Text>{health}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 2: Full live smoke test against real Hermes**

On the iPhone, exercise: connect → chat (with table + code + a tool-using prompt to trigger `hermes.tool.progress`) → reconnect after killing the app (creds persist) → Settings health check. Capture the raw SSE from a real response (temporary `console.log(ev.data)` in `sendMessage`).

- [ ] **Step 3: Reconcile fixtures with reality**

Compare logged real SSE payloads to `sse-chunks.ts`. If the real shapes differ, update the fixtures and re-run `npm test -- hermes-stream` until green against real data. Remove the temporary `console.log`.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add app/settings.tsx src/__tests__/fixtures/sse-chunks.ts src/hermes.ts
git commit -m "feat: settings + health check; reconcile SSE fixtures with live data"
```

---

## Slice 1 done = working app

Connect → chat → streaming markdown → status, on your iPhone, against your real Hermes. Slice 2 (runs lifecycle + one-tap approve/stop) builds on `hermes.ts` and reuses every screen.
