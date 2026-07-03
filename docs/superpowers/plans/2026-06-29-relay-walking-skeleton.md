# Relay Walking Skeleton (Slice 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the full connector → relay → app chain works end-to-end: paste-run the connector on the Hermes VPS, enter the printed 6-digit code in the app, type a message, and see a real streaming Hermes reply.

**Architecture:** Three new pieces alongside the existing app. A Go connector on the user's VPS dials out to a Cloudflare Durable Object relay; the app pairs to that DO with a 6-digit code and streams chat through the relay. The relay is thin — it does pairing and opaque frame forwarding; chat content never parsed. The existing direct-mode path is untouched.

**Tech Stack:** Expo SDK 56 (RN 0.85, React 19), Cloudflare Workers + Durable Objects (TypeScript), Go 1.22, gorilla/websocket, vitest + @cloudflare/vitest-pool-workers, jest-expo.

## Global Constraints

- **Expo SDK 56** — RN 0.85, React 19. API docs: https://docs.expo.dev/versions/v56.0.0/
- **Green bar = `npx tsc --noEmit` + `npm test` both pass** for the app; `go test ./...` passes for the connector; `npm test` in `/relay/` passes for the relay.
- **Theme tokens only** — `colors, space, radius, typography, screenPadding` from `@/theme`. No raw hex or magic numbers in components.
- **React Compiler is ON** — no manual `useMemo`/`useCallback`; follow hooks rules strictly (all hooks before early returns).
- **Secrets stay on-device** — Keychain only (via `expo-secure-store`). The pairing code is the Keychain secret for relay agents (the "device token" for the spike; persistent tokens are 3c).
- **Direct mode untouched** — all existing direct-mode tests and behavior stay green.
- **Relay agent record:** `transport: 'relay'`, `baseUrl: null`, `framework: 'hermes'`, capabilities from the `paired` frame.
- **Path aliases (app):** `@/*` → `src/*`.
- **Monorepo layout:** `/relay/` (own `package.json`/`wrangler.toml`/`vitest`), `/connector/` (own `go.mod`), `/protocol/` (shared protocol types for relay). Root tsconfig and Jest exclude these directories.

---

### Task 1: Monorepo structure + protocol types

Set up the three new top-level directories, exclude them from the root TypeScript/Jest configs, and define the shared protocol types that the relay and connector use.

**Files:**
- Modify: `tsconfig.json`
- Modify: `package.json` (jest `testPathIgnorePatterns`)
- Create: `protocol/protocol.ts`
- Create: `src/agents/relay/types.ts` (app-side copy of the protocol types; avoids cross-package tsconfig complexity)

**Interfaces:**
- Produces: `HelloFrame`, `CodeFrame`, `PairFrame`, `PairedFrame`, `PairErrorFrame`, `PeerGoneFrame`, `ChatFrame`, `ChatMessage`, `ChunkFrame`, `DoneFrame`, `ErrorFrame`, `AnyFrame` — exported from both `protocol/protocol.ts` (for relay) and `src/agents/relay/types.ts` (for app). Both files contain identical definitions.

- [ ] **Step 1: Exclude relay/connector/protocol from root tsconfig**

Open `tsconfig.json`. Replace with:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["jest"],
    "paths": {
      "@/*": ["./src/*"],
      "@/assets/*": ["./assets/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ],
  "exclude": [
    "node_modules",
    "relay",
    "connector",
    "protocol"
  ]
}
```

- [ ] **Step 2: Exclude relay from root Jest**

In `package.json`, add `testPathIgnorePatterns` to the `"jest"` block:

```json
"jest": {
  "preset": "jest-expo",
  "setupFilesAfterEnv": ["<rootDir>/jest-setup.ts"],
  "testPathIgnorePatterns": [
    "/node_modules/",
    "/relay/",
    "/connector/",
    "/protocol/"
  ],
  "moduleNameMapper": {
    "^@testing-library/react-native/extend-expect$": "<rootDir>/node_modules/@testing-library/react-native/dist/matchers/extend-expect"
  }
}
```

- [ ] **Step 3: Create the canonical protocol types**

Create `protocol/protocol.ts`:

```typescript
/** Canonical relay protocol frame types. Relay imports from here directly. */

export type HelloFrame      = { t: 'hello'; framework: string; agentName: string; agentVersion: string };
export type CodeFrame       = { t: 'code'; code: string };
export type PairFrame       = { t: 'pair'; code: string };
export type PairedFrame     = { t: 'paired'; framework: string; agentName: string; agentVersion: string };
export type PairErrorFrame  = { t: 'pair_error'; reason: 'not_found' | 'expired' | 'already_paired' };
export type PeerGoneFrame   = { t: 'peer_gone' };
export type ChatMessage     = { role: 'user' | 'assistant' | 'system'; content: string };
export type ChatFrame       = { t: 'chat'; reqId: string; messages: ChatMessage[] };
export type ChunkFrame      = { t: 'chunk'; reqId: string; delta: string };
export type DoneFrame       = { t: 'done'; reqId: string };
export type ErrorFrame      = { t: 'error'; reqId?: string; message: string };

export type AnyFrame =
  | HelloFrame | CodeFrame | PairFrame | PairedFrame | PairErrorFrame
  | PeerGoneFrame | ChatFrame | ChunkFrame | DoneFrame | ErrorFrame;
```

- [ ] **Step 4: Create the app-side copy of protocol types**

Create `src/agents/relay/types.ts` with identical content (the app imports from here, not from the root `protocol/` dir):

```typescript
/** App-side relay protocol types. Mirror of /protocol/protocol.ts — keep in sync. */

export type HelloFrame      = { t: 'hello'; framework: string; agentName: string; agentVersion: string };
export type CodeFrame       = { t: 'code'; code: string };
export type PairFrame       = { t: 'pair'; code: string };
export type PairedFrame     = { t: 'paired'; framework: string; agentName: string; agentVersion: string };
export type PairErrorFrame  = { t: 'pair_error'; reason: 'not_found' | 'expired' | 'already_paired' };
export type PeerGoneFrame   = { t: 'peer_gone' };
export type ChatMessage     = { role: 'user' | 'assistant' | 'system'; content: string };
export type ChatFrame       = { t: 'chat'; reqId: string; messages: ChatMessage[] };
export type ChunkFrame      = { t: 'chunk'; reqId: string; delta: string };
export type DoneFrame       = { t: 'done'; reqId: string };
export type ErrorFrame      = { t: 'error'; reqId?: string; message: string };

export type AnyFrame =
  | HelloFrame | CodeFrame | PairFrame | PairedFrame | PairErrorFrame
  | PeerGoneFrame | ChatFrame | ChunkFrame | DoneFrame | ErrorFrame;
```

- [ ] **Step 5: Typecheck + test the app still passes**

```bash
npx tsc --noEmit
npm test
```

Expected: clean tsc, all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json package.json protocol/protocol.ts src/agents/relay/types.ts
git commit -m "chore: monorepo structure — relay/connector/protocol dirs, protocol types"
```

---

### Task 2: Relay — Cloudflare Worker + Durable Object

The relay is a standalone Cloudflare Workers project in `/relay/`. The Worker upgrades WS connections and routes them into `PairingChannel` Durable Objects (one per code). The DO handles pairing and bidirectional frame forwarding.

The core pairing logic is extracted into pure functions so it can be tested without a Workers environment.

**Files:**
- Create: `relay/package.json`
- Create: `relay/tsconfig.json`
- Create: `relay/wrangler.toml`
- Create: `relay/vitest.config.ts`
- Create: `relay/src/logic.ts` (pure pairing/forward logic — fully unit-testable)
- Create: `relay/src/channel.ts` (PairingChannel DO — thin shell over logic.ts)
- Create: `relay/src/index.ts` (Worker entry — WS upgrade + routing)
- Create: `relay/src/__tests__/logic.test.ts`

**Interfaces:**
- Consumes: `protocol/protocol.ts` via `../../protocol/protocol`
- Produces: WS endpoint at `ws://localhost:8787` (wrangler dev). Connector connects without `?code`. App connects with `?code=NNNNNN`.

- [ ] **Step 1: Create relay package files**

Create `relay/package.json`:

```json
{
  "name": "summit-relay",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0",
    "wrangler": "^3.0.0"
  }
}
```

Create `relay/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "../../protocol/**/*.ts"]
}
```

Create `relay/wrangler.toml`:

```toml
name = "summit-relay"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "PAIRING_CHANNEL"
class_name = "PairingChannel"

[[migrations]]
tag = "v1"
new_classes = ["PairingChannel"]
```

Create `relay/vitest.config.ts`:

```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

- [ ] **Step 2: Install relay dependencies**

```bash
cd relay && npm install && cd ..
```

Expected: `relay/node_modules` created, no errors.

- [ ] **Step 3: Write the failing pure-logic tests**

Create `relay/src/__tests__/logic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  makeInitialState,
  handleConnectorOpen,
  handleConnectorMessage,
  handleAppMessage,
  handleConnectorClose,
  handleAppClose,
} from '../logic';

describe('handleConnectorOpen', () => {
  it('sets the code and replies with a code frame', () => {
    const { state, effects } = handleConnectorOpen(makeInitialState(), '481920');
    expect(state.code).toBe('481920');
    expect(effects).toEqual([{ to: 'connector', frame: { t: 'code', code: '481920' } }]);
  });

  it('rejects a second connector with occupied', () => {
    const { state } = handleConnectorOpen(makeInitialState(), '481920');
    const { occupied } = handleConnectorOpen(state, '481920');
    expect(occupied).toBe(true);
  });
});

describe('handleConnectorMessage — hello', () => {
  it('stores connector info and replies with code', () => {
    const base = makeInitialState();
    const { state, effects } = handleConnectorMessage(
      { ...base, code: '111111' },
      { t: 'hello', framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' },
    );
    expect(state.connectorInfo).toEqual({ framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
    expect(effects).toEqual([{ to: 'connector', frame: { t: 'code', code: '111111' } }]);
  });
});

describe('handleConnectorMessage — passthrough', () => {
  it('forwards chunk/done/error to app', () => {
    const base = { ...makeInitialState(), code: '111111' };
    const chunk = { t: 'chunk' as const, reqId: 'r1', delta: 'hi' };
    const { effects } = handleConnectorMessage(base, chunk);
    expect(effects).toEqual([{ to: 'app', frame: chunk }]);
  });
});

describe('handleAppMessage — pair', () => {
  it('sends paired when connector info is present', () => {
    const state = {
      ...makeInitialState(),
      code: '111111',
      connectorInfo: { framework: 'hermes', agentName: 'A', agentVersion: '1' },
    };
    const { effects } = handleAppMessage(state, { t: 'pair', code: '111111' });
    expect(effects).toEqual([{
      to: 'app',
      frame: { t: 'paired', framework: 'hermes', agentName: 'A', agentVersion: '1' },
    }]);
  });

  it('sends pair_error when connector not present', () => {
    const { effects } = handleAppMessage(makeInitialState(), { t: 'pair', code: '999999' });
    expect(effects).toEqual([{ to: 'app', frame: { t: 'pair_error', reason: 'not_found' } }]);
  });
});

describe('handleAppMessage — passthrough', () => {
  it('forwards chat to connector', () => {
    const chat = { t: 'chat' as const, reqId: 'r1', messages: [{ role: 'user' as const, content: 'hi' }] };
    const { effects } = handleAppMessage(makeInitialState(), chat);
    expect(effects).toEqual([{ to: 'connector', frame: chat }]);
  });
});

describe('peer_gone on close', () => {
  it('handleConnectorClose sends peer_gone to app', () => {
    const { effects } = handleConnectorClose(makeInitialState());
    expect(effects).toEqual([{ to: 'app', frame: { t: 'peer_gone' } }]);
  });

  it('handleAppClose sends peer_gone to connector', () => {
    const { effects } = handleAppClose(makeInitialState());
    expect(effects).toEqual([{ to: 'connector', frame: { t: 'peer_gone' } }]);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd relay && npm test && cd ..
```

Expected: FAIL — `Cannot find module '../logic'`.

- [ ] **Step 5: Write the pure logic module**

Create `relay/src/logic.ts`:

```typescript
import type { AnyFrame, PairedFrame, PairErrorFrame, PeerGoneFrame } from '../../protocol/protocol';

export type ConnectorInfo = { framework: string; agentName: string; agentVersion: string };

export type ChannelState = {
  code: string | null;
  connectorInfo: ConnectorInfo | null;
};

export type SideEffect =
  | { to: 'connector'; frame: AnyFrame }
  | { to: 'app'; frame: AnyFrame };

export type HandleResult = { state: ChannelState; effects: SideEffect[]; occupied?: boolean };

export function makeInitialState(): ChannelState {
  return { code: null, connectorInfo: null };
}

export function handleConnectorOpen(state: ChannelState, code: string): HandleResult {
  if (state.code !== null) {
    return { state, effects: [], occupied: true };
  }
  return {
    state: { ...state, code },
    effects: [{ to: 'connector', frame: { t: 'code', code } }],
  };
}

export function handleConnectorMessage(state: ChannelState, frame: AnyFrame): HandleResult {
  if (frame.t === 'hello') {
    return {
      state: {
        ...state,
        connectorInfo: { framework: frame.framework, agentName: frame.agentName, agentVersion: frame.agentVersion },
      },
      effects: [{ to: 'connector', frame: { t: 'code', code: state.code! } }],
    };
  }
  return { state, effects: [{ to: 'app', frame }] };
}

export function handleAppMessage(state: ChannelState, frame: AnyFrame): HandleResult {
  if (frame.t === 'pair') {
    if (!state.connectorInfo) {
      const reply: PairErrorFrame = { t: 'pair_error', reason: 'not_found' };
      return { state, effects: [{ to: 'app', frame: reply }] };
    }
    const reply: PairedFrame = { t: 'paired', ...state.connectorInfo };
    return { state, effects: [{ to: 'app', frame: reply }] };
  }
  return { state, effects: [{ to: 'connector', frame }] };
}

export function handleConnectorClose(state: ChannelState): HandleResult {
  const gone: PeerGoneFrame = { t: 'peer_gone' };
  return { state: { ...state, connectorInfo: null }, effects: [{ to: 'app', frame: gone }] };
}

export function handleAppClose(state: ChannelState): HandleResult {
  const gone: PeerGoneFrame = { t: 'peer_gone' };
  return { state, effects: [{ to: 'connector', frame: gone }] };
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd relay && npm test && cd ..
```

Expected: all 9 tests PASS.

- [ ] **Step 7: Write the PairingChannel DO**

Create `relay/src/channel.ts`:

```typescript
import {
  makeInitialState, handleConnectorOpen, handleConnectorMessage,
  handleAppMessage, handleConnectorClose, handleAppClose,
} from './logic';
import type { ChannelState, SideEffect } from './logic';
import type { AnyFrame } from '../../protocol/protocol';

export class PairingChannel {
  private state: ChannelState = makeInitialState();

  constructor(private readonly doState: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') as 'connector' | 'app';
    const code = url.searchParams.get('code')!;

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    if (role === 'connector') {
      const { occupied } = handleConnectorOpen(this.state, code);
      if (occupied) return new Response('Already occupied', { status: 409 });
      this.doState.acceptWebSocket(server, ['connector']);
    } else {
      this.doState.acceptWebSocket(server, ['app']);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const frame = JSON.parse(
      typeof message === 'string' ? message : new TextDecoder().decode(message),
    ) as AnyFrame;
    const role = this.doState.getTags(ws)[0] as 'connector' | 'app';

    const result = role === 'connector'
      ? handleConnectorMessage(this.state, frame)
      : handleAppMessage(this.state, frame);

    this.state = result.state;
    this.dispatch(result.effects);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const role = this.doState.getTags(ws)[0] as 'connector' | 'app';
    const result = role === 'connector'
      ? handleConnectorClose(this.state)
      : handleAppClose(this.state);
    this.state = result.state;
    this.dispatch(result.effects);
  }

  private dispatch(effects: SideEffect[]): void {
    const sockets = this.doState.getWebSockets();
    for (const effect of effects) {
      const target = sockets.find((s) => this.doState.getTags(s)[0] === effect.to);
      target?.send(JSON.stringify(effect.frame));
    }
  }
}
```

- [ ] **Step 8: Write the Worker entry**

Create `relay/src/index.ts`:

```typescript
import { PairingChannel } from './channel';

export { PairingChannel };

export interface Env {
  PAIRING_CHANNEL: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Summit Relay — WebSocket only', { status: 200 });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (code) {
      // App connecting: route by code
      const id = env.PAIRING_CHANNEL.idFromName(code);
      const url2 = new URL(request.url);
      url2.searchParams.set('role', 'app');
      return env.PAIRING_CHANNEL.get(id).fetch(new Request(url2.toString(), request));
    }

    // Connector connecting: mint a unique code
    for (let i = 0; i < 5; i++) {
      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      const id = env.PAIRING_CHANNEL.idFromName(newCode);
      const url2 = new URL(request.url);
      url2.searchParams.set('code', newCode);
      url2.searchParams.set('role', 'connector');
      const resp = await env.PAIRING_CHANNEL.get(id).fetch(new Request(url2.toString(), request));
      if (resp.status !== 409) return resp;
    }
    return new Response('Could not mint unique code', { status: 500 });
  },
};
```

- [ ] **Step 9: Typecheck the relay**

```bash
cd relay && npx tsc --noEmit && cd ..
```

Expected: no errors.

- [ ] **Step 10: Smoke-test with wrangler dev**

```bash
cd relay && npm run dev
```

Expected: `wrangler dev` starts, prints something like:
```
⎯⎯⎯⎯⎯⎯⎯ Starting local server ⎯⎯⎯⎯⎯⎯⎯
[wrangler] Ready on http://localhost:8787
```

Keep this running for the connector test in Task 3. Stop it with Ctrl+C when done.

- [ ] **Step 11: Commit**

```bash
git add relay/
git commit -m "feat: add Cloudflare relay — Worker + PairingChannel Durable Object"
```

---

### Task 3: Connector (Go binary)

A foreground Go process that dials the relay, sends `hello`, prints the 6-digit code, and on `chat` frames streams from Hermes and emits `chunk`/`done`/`error` back through the relay.

**Files:**
- Create: `connector/go.mod`
- Create: `connector/go.sum` (generated by `go mod tidy`)
- Create: `connector/main.go`
- Create: `connector/hermes.go`
- Create: `connector/hermes_test.go`

**Interfaces:**
- Env vars consumed: `RELAY_URL` (default `ws://localhost:8787`), `HERMES_BASE_URL` (e.g. `http://localhost:8642`), `HERMES_API_KEY`.
- Produces: binary that connects to relay, prints code, bridges chat.

- [ ] **Step 1: Initialise the Go module**

```bash
mkdir connector && cd connector
go mod init github.com/summit-app/connector
go get github.com/gorilla/websocket@v1.5.3
cd ..
```

Expected: `connector/go.mod` and `connector/go.sum` created.

- [ ] **Step 2: Write the failing SSE test**

Create `connector/hermes_test.go`:

```go
package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStreamChat_parsesDeltas(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify auth header
		if r.Header.Get("Authorization") != "Bearer test-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		fmt.Fprintln(w, `data: {"choices":[{"delta":{"content":"He"}}]}`)
		fmt.Fprintln(w, `data: {"choices":[{"delta":{"content":"llo"}}]}`)
		fmt.Fprintln(w, "data: [DONE]")
		w.(http.Flusher).Flush()
	}))
	defer srv.Close()

	msgs := []ChatMessage{{Role: "user", Content: "hi"}}
	frames := streamChat(msgs, srv.URL, "test-key")

	var got []Frame
	for f := range frames {
		got = append(got, f)
	}

	if len(got) != 3 {
		t.Fatalf("expected 3 frames, got %d: %+v", len(got), got)
	}
	if got[0].T != "chunk" || got[0].Delta != "He" {
		t.Errorf("frame 0: %+v", got[0])
	}
	if got[1].T != "chunk" || got[1].Delta != "llo" {
		t.Errorf("frame 1: %+v", got[1])
	}
	if got[2].T != "done" {
		t.Errorf("frame 2: %+v", got[2])
	}
}

func TestStreamChat_propagatesHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintln(w, `{"error":"invalid key"}`)
	}))
	defer srv.Close()

	frames := streamChat([]ChatMessage{{Role: "user", Content: "hi"}}, srv.URL, "bad")
	var got []Frame
	for f := range frames {
		got = append(got, f)
	}

	if len(got) != 1 || got[0].T != "error" {
		t.Fatalf("expected one error frame, got %+v", got)
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd connector && go test ./... && cd ..
```

Expected: FAIL — `undefined: streamChat` and `undefined: ChatMessage`.

- [ ] **Step 4: Write `hermes.go`**

Create `connector/hermes.go`:

```go
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// streamChat calls Hermes /v1/chat/completions with stream:true and returns a
// channel of frames (chunk per token, then done; error on failure).
func streamChat(messages []ChatMessage, baseURL, apiKey string) <-chan Frame {
	ch := make(chan Frame, 64)
	go func() {
		defer close(ch)

		payload, err := json.Marshal(map[string]interface{}{
			"model":    "hermes",
			"messages": messages,
			"stream":   true,
		})
		if err != nil {
			ch <- Frame{T: "error", Message: fmt.Sprintf("marshal: %v", err)}
			return
		}

		req, err := http.NewRequest("POST", baseURL+"/v1/chat/completions", bytes.NewReader(payload))
		if err != nil {
			ch <- Frame{T: "error", Message: fmt.Sprintf("build request: %v", err)}
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+apiKey)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			ch <- Frame{T: "error", Message: fmt.Sprintf("http: %v", err)}
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			ch <- Frame{T: "error", Message: fmt.Sprintf("hermes %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))}
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				break
			}
			var ev struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}
			if err := json.Unmarshal([]byte(data), &ev); err != nil {
				continue
			}
			if len(ev.Choices) > 0 && ev.Choices[0].Delta.Content != "" {
				ch <- Frame{T: "chunk", Delta: ev.Choices[0].Delta.Content}
			}
		}
		ch <- Frame{T: "done"}
	}()
	return ch
}
```

- [ ] **Step 5: Write `main.go`**

Create `connector/main.go`:

```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/gorilla/websocket"
)

// Frame is the shared JSON envelope for all relay protocol messages.
type Frame struct {
	T            string        `json:"t"`
	Framework    string        `json:"framework,omitempty"`
	AgentName    string        `json:"agentName,omitempty"`
	AgentVersion string        `json:"agentVersion,omitempty"`
	Code         string        `json:"code,omitempty"`
	ReqID        string        `json:"reqId,omitempty"`
	Delta        string        `json:"delta,omitempty"`
	Message      string        `json:"message,omitempty"`
	Messages     []ChatMessage `json:"messages,omitempty"`
}

// ChatMessage matches the OpenAI messages array shape.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func main() {
	relayURL := os.Getenv("RELAY_URL")
	if relayURL == "" {
		relayURL = "ws://localhost:8787"
	}
	hermesBase := strings.TrimRight(os.Getenv("HERMES_BASE_URL"), "/")
	apiKey := os.Getenv("HERMES_API_KEY")

	if hermesBase == "" || apiKey == "" {
		log.Fatal("HERMES_BASE_URL and HERMES_API_KEY must be set")
	}
	if !strings.HasPrefix(hermesBase, "http") {
		hermesBase = "http://" + hermesBase
	}

	conn, _, err := websocket.DefaultDialer.Dial(relayURL, nil)
	if err != nil {
		log.Fatalf("dial relay %s: %v", relayURL, err)
	}
	defer conn.Close()
	log.Printf("connected to relay %s", relayURL)

	if err := conn.WriteJSON(Frame{
		T: "hello", Framework: "hermes", AgentName: "Hermes", AgentVersion: "1.0",
	}); err != nil {
		log.Fatalf("send hello: %v", err)
	}

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("relay closed: %v", err)
			return
		}
		var f Frame
		if err := json.Unmarshal(msg, &f); err != nil {
			log.Printf("bad frame: %v", err)
			continue
		}
		switch f.T {
		case "code":
			fmt.Printf("\n  Pairing code: %s\n\n  Enter this code in the Summit app.\n\n", f.Code)
		case "chat":
			go handleChat(conn, f, hermesBase, apiKey)
		case "peer_gone":
			fmt.Println("App disconnected — waiting for reconnect.")
		default:
			log.Printf("unknown frame %q", f.T)
		}
	}
}

func handleChat(conn *websocket.Conn, f Frame, hermesBase, apiKey string) {
	for frame := range streamChat(f.Messages, hermesBase, apiKey) {
		frame.ReqID = f.ReqID
		if err := conn.WriteJSON(frame); err != nil {
			log.Printf("write frame: %v", err)
			return
		}
	}
}
```

- [ ] **Step 6: Run the Go tests**

```bash
cd connector && go test ./... -v && cd ..
```

Expected: PASS — `TestStreamChat_parsesDeltas` and `TestStreamChat_propagatesHTTPError`.

- [ ] **Step 7: Build the connector**

```bash
cd connector && go build -o connector . && cd ..
```

Expected: `connector/connector` binary produced, no errors.

- [ ] **Step 8: Manual smoke test (optional but recommended)**

With `wrangler dev` running (`cd relay && npm run dev`):

```bash
HERMES_BASE_URL=http://your-hermes-host:8642 HERMES_API_KEY=your-key ./connector/connector
```

Expected output:
```
connected to relay ws://localhost:8787

  Pairing code: 481920

  Enter this code in the Summit app.
```

- [ ] **Step 9: Commit**

```bash
git add connector/
git commit -m "feat: add Go connector — dials relay, bridges Hermes SSE"
```

---

### Task 4: App — RelayClient

A stateful WebSocket manager for the app side of the relay. Handles connecting, pairing, and driving the `chat` async iterable. Fully unit-tested with a mock WebSocket.

**Files:**
- Create: `src/agents/relay/client.ts`
- Create: `__tests__/agents/relay/client.test.ts`

**Interfaces:**
- Consumes: `src/agents/relay/types.ts` (AnyFrame, PairedFrame, PairErrorFrame, ChatMessage etc.)
- Produces:
  - `export type RelayAgentInfo = { framework: string; agentName: string; agentVersion: string }`
  - `export class RelayClient`
    - `constructor(wsUrl: string)`
    - `pair(code: string): Promise<RelayAgentInfo>` — connects if needed, sends pair frame, resolves on `paired`, rejects on `pair_error` or WS error
    - `chat(messages: ChatMessage[], reqId: string): AsyncIterable<StreamEvent>` — sends chat frame, yields `delta`/`done`/`error` StreamEvents until done
    - `disconnect(): void` — closes the WS

- [ ] **Step 1: Write the failing tests**

Create `__tests__/agents/relay/client.test.ts`:

```typescript
import { RelayClient } from '@/agents/relay/client';

// ─── Mock WebSocket ──────────────────────────────────────────────────────────
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  readyState = 1; // OPEN

  send(data: string) { this.sent.push(data); }
  close() { this.onclose?.(); }
  receive(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  openNow() { this.readyState = 1; this.onopen?.(); }
}

let mockWs: MockWebSocket;
const originalWebSocket = global.WebSocket;

beforeEach(() => {
  mockWs = new MockWebSocket();
  (global as any).WebSocket = jest.fn(() => mockWs);
});

afterEach(() => {
  (global as any).WebSocket = originalWebSocket;
});

// ─── pair() ──────────────────────────────────────────────────────────────────
describe('pair()', () => {
  it('resolves with agent info on paired frame', async () => {
    const client = new RelayClient('ws://localhost:8787?code=111111');
    const promise = client.pair('111111');
    mockWs.openNow();
    mockWs.receive({ t: 'paired', framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
    const info = await promise;
    expect(info).toEqual({ framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
    expect(JSON.parse(mockWs.sent[0])).toEqual({ t: 'pair', code: '111111' });
  });

  it('rejects on pair_error', async () => {
    const client = new RelayClient('ws://localhost:8787?code=badcode');
    const promise = client.pair('badcode');
    mockWs.openNow();
    mockWs.receive({ t: 'pair_error', reason: 'not_found' });
    await expect(promise).rejects.toThrow('not_found');
  });
});

// ─── chat() ──────────────────────────────────────────────────────────────────
describe('chat()', () => {
  it('yields delta events then done', async () => {
    const client = new RelayClient('ws://localhost:8787?code=111111');
    // Pre-open the connection
    mockWs.openNow();

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-1');

    const collecting = (async () => {
      for await (const ev of gen) events.push(ev);
    })();

    expect(JSON.parse(mockWs.sent[0])).toMatchObject({ t: 'chat', reqId: 'req-1' });
    mockWs.receive({ t: 'chunk', reqId: 'req-1', delta: 'He' });
    mockWs.receive({ t: 'chunk', reqId: 'req-1', delta: 'llo' });
    mockWs.receive({ t: 'done', reqId: 'req-1' });

    await collecting;
    expect(events).toEqual([
      { type: 'delta', text: 'He' },
      { type: 'delta', text: 'Hello' }, // accumulated
      { type: 'done' },
    ]);
  });

  it('yields error event on error frame', async () => {
    const client = new RelayClient('ws://localhost:8787?code=111111');
    mockWs.openNow();

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-2');
    const collecting = (async () => { for await (const ev of gen) events.push(ev); })();

    mockWs.receive({ t: 'error', reqId: 'req-2', message: 'upstream failed' });
    await collecting;
    expect(events).toEqual([{ type: 'error', message: 'upstream failed' }]);
  });

  it('yields error event on peer_gone', async () => {
    const client = new RelayClient('ws://localhost:8787?code=111111');
    mockWs.openNow();

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-3');
    const collecting = (async () => { for await (const ev of gen) events.push(ev); })();

    mockWs.receive({ t: 'peer_gone' });
    await collecting;
    expect(events).toEqual([{ type: 'error', message: 'Agent disconnected.' }]);
  });
});
```

> **Note on the `delta` accumulation test:** The test above asserts that `chat()` yields _accumulated_ text (the whole text so far), not just the raw delta from each frame. This matches how `reduceTurn` works in the chat screen. Adjust to raw deltas if you prefer — but keep it consistent with how the RelayAdapter uses it.

Actually, simpler to yield raw deltas and let `reduceTurn` accumulate. Update the test to expect raw deltas:

Replace the `events` assertion in the `chat()` yields test:

```typescript
    expect(events).toEqual([
      { type: 'delta', text: 'He' },
      { type: 'delta', text: 'llo' },
      { type: 'done' },
    ]);
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx jest __tests__/agents/relay/client.test.ts
```

Expected: FAIL — `Cannot find module '@/agents/relay/client'`.

- [ ] **Step 3: Write `RelayClient`**

Create `src/agents/relay/client.ts`:

```typescript
import type { AnyFrame, ChatMessage } from './types';
import type { StreamEvent } from '../adapters/types';

export type RelayAgentInfo = { framework: string; agentName: string; agentVersion: string };

export class RelayClient {
  private ws: WebSocket | null = null;
  private handlers: Array<(frame: AnyFrame) => void> = [];

  constructor(private readonly wsUrl: string) {}

  private getWs(): WebSocket {
    if (this.ws) return this.ws;
    const ws = new WebSocket(this.wsUrl);
    ws.onmessage = (e) => {
      const frame = JSON.parse(e.data as string) as AnyFrame;
      for (const h of this.handlers) h(frame);
    };
    this.ws = ws;
    return ws;
  }

  pair(code: string): Promise<RelayAgentInfo> {
    return new Promise((resolve, reject) => {
      const ws = this.getWs();

      const handler = (frame: AnyFrame) => {
        if (frame.t === 'paired') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          resolve({ framework: frame.framework, agentName: frame.agentName, agentVersion: frame.agentVersion });
        } else if (frame.t === 'pair_error') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          reject(new Error(frame.reason));
        }
      };
      this.handlers.push(handler);

      const send = () => ws.send(JSON.stringify({ t: 'pair', code }));
      if (ws.readyState === WebSocket.OPEN) {
        send();
      } else {
        ws.onopen = send;
        ws.onerror = () => reject(new Error('WebSocket error'));
      }
    });
  }

  async *chat(messages: ChatMessage[], reqId: string): AsyncIterable<StreamEvent> {
    const ws = this.getWs();
    ws.send(JSON.stringify({ t: 'chat', reqId, messages }));

    const queue: StreamEvent[] = [];
    let notify: (() => void) | null = null;
    let done = false;

    const handler = (frame: AnyFrame) => {
      if (frame.t === 'chunk' && frame.reqId === reqId) {
        queue.push({ type: 'delta', text: frame.delta });
      } else if (frame.t === 'done' && frame.reqId === reqId) {
        queue.push({ type: 'done' });
        done = true;
      } else if (frame.t === 'error' && (!frame.reqId || frame.reqId === reqId)) {
        queue.push({ type: 'error', message: frame.message });
        done = true;
      } else if (frame.t === 'peer_gone') {
        queue.push({ type: 'error', message: 'Agent disconnected.' });
        done = true;
      } else {
        return;
      }
      notify?.();
      notify = null;
    };
    this.handlers.push(handler);

    try {
      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((r) => { notify = r; });
        }
        while (queue.length > 0) yield queue.shift()!;
      }
    } finally {
      this.handlers = this.handlers.filter((h) => h !== handler);
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/agents/relay/client.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/agents/relay/ __tests__/agents/relay/
git commit -m "feat: add RelayClient — WS pair + chat async iterable"
```

---

### Task 5: App — RelayAdapter + makeAdapter wiring + AgentProvider memoization

Wire the relay transport into the adapter factory. The RelayAdapter lazily connects and pairs on first `sendMessage`, then reuses the connection. Fix AgentProvider to memoize adapters per agent (required so the RelayClient connection persists across multiple `sendMessage` calls).

**Files:**
- Create: `src/agents/adapters/relay.ts`
- Modify: `src/agents/adapters/index.ts`
- Modify: `src/agents/AgentProvider.tsx`
- Create: `__tests__/agents/adapters/relay.test.ts`
- Modify: `src/config.ts`

**Interfaces:**
- Consumes: `RelayClient` from `src/agents/relay/client.ts`; `RELAY_WS_URL` from `src/config.ts`
- Produces: `RelayAdapter implements AgentAdapter` — `sendMessage` is the only fully wired method; others stub to satisfy the interface.

- [ ] **Step 1: Add RELAY_WS_URL to config**

Replace the entire content of `src/config.ts`:

```typescript
export const SIGNUP_ENABLED = __DEV__;

/**
 * WebSocket base URL for the relay. The pairing code is appended as ?code=NNNNNN.
 * In dev, wrangler dev runs locally on 8787. In production, the deployed Worker.
 */
export const RELAY_WS_URL = __DEV__
  ? 'ws://localhost:8787'
  : 'wss://relay.summitapp.dev';
```

- [ ] **Step 2: Write the failing RelayAdapter tests**

Create `__tests__/agents/adapters/relay.test.ts`:

```typescript
import { RelayAdapter } from '@/agents/adapters/relay';
import type { Agent } from '@/agents/types';
import type { StreamEvent } from '@/agents/adapters/types';

const fakeAgent: Agent = {
  id: 'a1',
  name: 'Test',
  framework: 'hermes',
  transport: 'relay',
  baseUrl: null,
  capabilities: null,
  createdAt: 0,
  lastUsedAt: 0,
};

// Mock RelayClient
const mockPair = jest.fn().mockResolvedValue({ framework: 'hermes', agentName: 'Test', agentVersion: '1' });
const mockChatEvents: StreamEvent[] = [
  { type: 'delta', text: 'Hi' },
  { type: 'done' },
];
async function* mockChat() { for (const e of mockChatEvents) yield e; }
const mockClientInstance = { pair: mockPair, chat: jest.fn().mockReturnValue(mockChat()), disconnect: jest.fn() };
jest.mock('@/agents/relay/client', () => ({
  RelayClient: jest.fn(() => mockClientInstance),
}));
jest.mock('@/config', () => ({
  RELAY_WS_URL: 'ws://test',
  SIGNUP_ENABLED: false,
}));

describe('RelayAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pairs on first sendMessage and yields StreamEvents', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => '481920');
    const events: StreamEvent[] = [];
    for await (const ev of adapter.sendMessage('hello')) {
      events.push(ev);
    }
    expect(mockPair).toHaveBeenCalledWith('481920');
    expect(events).toEqual(mockChatEvents);
  });

  it('does not pair again on second sendMessage', async () => {
    const adapter = new RelayAdapter(fakeAgent, async () => '481920');
    // First call
    for await (const _ of adapter.sendMessage('msg1')) {}
    // Second call — reset the mock return value
    mockClientInstance.chat.mockReturnValue(mockChat());
    for await (const _ of adapter.sendMessage('msg2')) {}
    expect(mockPair).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

```bash
npx jest __tests__/agents/adapters/relay.test.ts
```

Expected: FAIL — `Cannot find module '@/agents/adapters/relay'`.

- [ ] **Step 4: Write `RelayAdapter`**

Create `src/agents/adapters/relay.ts`:

```typescript
import type { AgentAdapter, AgentStatus, SendOptions, StreamEvent } from './types';
import type { AgentCapabilities, AgentFramework, Agent } from '../types';
import type { ChatMessage } from '../relay/types';
import { RelayClient } from '../relay/client';
import { RELAY_WS_URL } from '@/config';

export class RelayAdapter implements AgentAdapter {
  readonly framework: AgentFramework = 'hermes';
  private client: RelayClient | null = null;

  constructor(
    private readonly agent: Agent,
    private readonly getSecret: () => Promise<string | null>,
  ) {}

  private async ensureConnected(): Promise<RelayClient> {
    if (this.client) return this.client;
    const code = await this.getSecret();
    if (!code) throw new Error('No pairing code stored for this agent.');
    const wsUrl = `${RELAY_WS_URL}?code=${encodeURIComponent(code)}`;
    const client = new RelayClient(wsUrl);
    await client.pair(code);
    this.client = client;
    return client;
  }

  async *sendMessage(content: string, opts?: SendOptions): AsyncIterable<StreamEvent> {
    const client = await this.ensureConnected();
    const messages: ChatMessage[] = [{ role: 'user', content }];
    const reqId = opts?.sessionId ?? String(Date.now());
    yield* client.chat(messages, reqId);
  }

  async testConnection(): Promise<AgentCapabilities> {
    throw new Error('Use the pairing screen to connect relay agents.');
  }

  async getStatus(): Promise<AgentStatus> {
    return 'idle';
  }

  async approveRun(_runId: string, _approved: boolean): Promise<void> {}

  async stopRun(_runId: string): Promise<void> {}
}
```

- [ ] **Step 5: Wire RelayAdapter into makeAdapter**

Replace the entire content of `src/agents/adapters/index.ts`:

```typescript
import type { Agent } from '../types';
import { getAgentSecret } from '../secrets';
import type { AgentAdapter } from './types';
import { HermesAdapter } from './hermes';
import { OpenClawAdapter } from './openclaw';
import { RelayAdapter } from './relay';

export function makeAdapter(
  agent: Agent,
  getSecret: () => Promise<string | null> = () => getAgentSecret(agent.id),
): AgentAdapter {
  if (agent.transport === 'relay') {
    return new RelayAdapter(agent, getSecret);
  }
  switch (agent.framework) {
    case 'hermes':
      return new HermesAdapter(agent, getSecret);
    case 'openclaw':
      return new OpenClawAdapter();
  }
}

export * from './types';
```

- [ ] **Step 6: Memoize adapterFor in AgentProvider**

The current `adapterFor: (agent) => makeAdapter(agent)` creates a new adapter on every call. The RelayAdapter holds a live WebSocket connection, so we need one adapter instance per agent per session.

In `src/agents/AgentProvider.tsx`, add a `useRef` import and an adapter cache. Change:

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
```

to:

```tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
```

Then find this block in `AgentProvider`:

```tsx
  const value: AgentContextValue = {
    ready,
    agents,
    activeAgent: resolveActive(agents, activeId),
    addAgent,
    removeAgent,
    selectAgent,
    adapterFor: (agent) => makeAdapter(agent),
    repo,
  };
```

Replace with:

```tsx
  const adapterCache = useRef<Map<string, AgentAdapter>>(new Map());

  const adapterFor = (agent: Agent): AgentAdapter => {
    const cached = adapterCache.current.get(agent.id);
    if (cached) return cached;
    const adapter = makeAdapter(agent);
    adapterCache.current.set(agent.id, adapter);
    return adapter;
  };

  const value: AgentContextValue = {
    ready,
    agents,
    activeAgent: resolveActive(agents, activeId),
    addAgent,
    removeAgent,
    selectAgent,
    adapterFor,
    repo,
  };
```

- [ ] **Step 7: Run all tests**

```bash
npx jest __tests__/agents/adapters/relay.test.ts
npm test
```

Expected: relay adapter tests PASS, full suite green.

- [ ] **Step 8: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/agents/adapters/relay.ts src/agents/adapters/index.ts src/agents/AgentProvider.tsx src/config.ts __tests__/agents/adapters/relay.test.ts
git commit -m "feat: add RelayAdapter and wire relay transport into makeAdapter"
```

---

### Task 6: App — Pair screen + layout + connect screen link

The 6-digit pairing screen. Connects to the relay, verifies the code, stores the pairing code as the Keychain secret, and routes to chat. The connect screen gains a "Use pairing code instead" link.

**Files:**
- Create: `src/app/(app)/pair.tsx`
- Modify: `src/app/(app)/_layout.tsx`
- Modify: `src/app/(app)/connect.tsx`

**Interfaces:**
- Consumes: `RelayClient` from `@/agents/relay/client`; `RELAY_WS_URL` from `@/config`; `useAgents()` from `@/agents/AgentProvider`; theme tokens from `@/theme`.
- Produces: route `/(app)/pair` — no new exports.

- [ ] **Step 1: Register the pair route in the layout**

Replace the entire content of `src/app/(app)/_layout.tsx`:

```tsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAgents } from '@/agents/AgentProvider';

function AgentGuard() {
  const { ready, activeAgent } = useAgents();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const last = segments[segments.length - 1];
    const onOnboarding = last === 'connect' || last === 'pair';
    if (!activeAgent && !onOnboarding) {
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
        <Stack.Screen name="pair" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="cron" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
```

- [ ] **Step 2: Create the pair screen**

Create `src/app/(app)/pair.tsx`:

```tsx
import React, { useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAgents } from '@/agents/AgentProvider';
import { RelayClient } from '@/agents/relay/client';
import { RELAY_WS_URL } from '@/config';
import { colors, space, radius, typography, screenPadding } from '@/theme';

export default function PairScreen() {
  const { addAgent } = useAgents();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<RelayClient | null>(null);

  const canSubmit = code.trim().length === 6 && !loading;

  async function handlePair() {
    setError(null);
    setLoading(true);
    const trimmed = code.trim();
    try {
      const wsUrl = `${RELAY_WS_URL}?code=${encodeURIComponent(trimmed)}`;
      const client = new RelayClient(wsUrl);
      clientRef.current = client;
      const info = await client.pair(trimmed);
      client.disconnect();
      clientRef.current = null;

      await addAgent(
        {
          name: info.agentName || 'Hermes',
          framework: 'hermes',
          transport: 'relay',
          baseUrl: null,
          capabilities: null,
        },
        trimmed,
      );
      router.replace('/(app)');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Pairing failed — check the code and try again.',
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
        <View style={styles.container}>
          <View style={styles.top}>
            <Text style={styles.title}>Enter pairing code</Text>
            <Text style={styles.subtitle}>
              Run the connector next to your agent and enter the 6-digit code it prints.
            </Text>
          </View>

          <TextInput
            style={[styles.codeInput, error ? styles.codeInputError : null]}
            placeholder="000000"
            placeholderTextColor={colors.faint}
            value={code}
            onChangeText={(t) => {
              setError(null);
              setCode(t.replace(/\D/g, '').slice(0, 6));
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={() => canSubmit && handlePair()}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handlePair}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.btnText}>Connect</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace('/(app)/connect')} hitSlop={8}>
            <Text style={styles.link}>Advanced: use host + API key instead</Text>
          </Pressable>
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
    paddingBottom: space.xl,
  },
  top: { gap: space.sm },
  title: { ...typography.title, color: colors.ink, letterSpacing: -0.5 },
  subtitle: { ...typography.body, color: colors.muted },
  codeInput: {
    ...typography.title,
    color: colors.ink,
    fontSize: 36,
    letterSpacing: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
    textAlign: 'center',
  },
  codeInputError: { borderColor: colors.error },
  error: { ...typography.caption, color: colors.error },
  btn: {
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { ...typography.body, fontWeight: '600', color: colors.bg },
  link: { ...typography.caption, color: colors.muted, textAlign: 'center' },
});
```

- [ ] **Step 3: Add "Use pairing code" link to connect screen**

At the bottom of the connect screen's scrollable content, after the primary button, add a link to the pair screen. In `src/app/(app)/connect.tsx`, find:

```tsx
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
```

Replace with:

```tsx
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

            <Pressable onPress={() => router.push('/(app)/pair')} hitSlop={8}>
              <Text style={styles.pairLink}>Use pairing code instead</Text>
            </Pressable>
          </View>
        </ScrollView>
```

Then add to the `StyleSheet.create({...})` in `connect.tsx`:

```tsx
  pairLink: { ...typography.caption, color: colors.muted, textAlign: 'center', marginTop: space.sm },
```

- [ ] **Step 4: Typecheck + full test run**

```bash
npx tsc --noEmit
npm test
```

Expected: clean tsc, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/pair.tsx" "src/app/(app)/_layout.tsx" "src/app/(app)/connect.tsx"
git commit -m "feat: add pair screen and relay navigation"
```

---

## End-to-End Acceptance Verification

After all 6 tasks are done, verify the walking skeleton works:

**Setup:**
1. In one terminal: `cd relay && npm run dev` (relay at `ws://localhost:8787`)
2. In another terminal:
   ```bash
   HERMES_BASE_URL=http://your-hermes-host:8642 \
   HERMES_API_KEY=your-key \
   RELAY_URL=ws://localhost:8787 \
   ./connector/connector
   ```
   Expected: prints `Pairing code: NNNNNN`

3. Start the app: `npm start` → open on device/simulator

**Test sequence:**
- [ ] App shows the Connect screen (no agent configured); tap "Use pairing code instead" → lands on Pair screen
- [ ] Enter the 6-digit code → tap Connect → brief pause → app routes to chat screen with agent name shown
- [ ] Type "hello" → reply streams token-by-token into the chat thread
- [ ] Kill the connector (Ctrl+C) → app shows an inline error message on the next send ("Agent disconnected.")
- [ ] Restart the connector → it prints a new code (same relay WS session) → enter the new code in the pair screen → chat works again

**Green bar check:**
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm test` — all pass
- [ ] `cd relay && npm test` — all pass
- [ ] `cd connector && go test ./...` — PASS

---

## Self-Review

**Spec coverage (slice 3a §4):**
- Connector: reads env, dials relay, sends `hello`, prints `code`, on `chat` streams from Hermes → Task 3 ✓
- Relay: WS upgrade, `PairingChannel` DO, pairing handshake, bidirectional forward, `peer_gone` on disconnect → Task 2 ✓
- App `RelayClient`: opens WS, `pair(code)`, `chat()` async iterable → Task 4 ✓
- App relay adapter, selected when `transport === 'relay'` → Task 5 ✓
- Pairing screen, 6-digit entry, on `paired` writes relay Agent row + stores code in Keychain → Task 6 ✓
- Acceptance criteria 1–5 verified in the end-to-end section ✓

**Explicitly out of scope (deferred, per spec §5):**
- `curl | sh` install, daemonisation, agent-assisted prompt → 3b
- Persistent device tokens, pairing-code expiry/rate-limit, relay auth hardening, production deploy → 3c
- Push notifications → 3d
- Approve/stop over relay, markdown streaming, transcript persistence → fast-follow

**Type consistency check:**
- `RelayClient.pair()` returns `RelayAgentInfo` → used in `pair.tsx` ✓
- `RelayClient.chat()` returns `AsyncIterable<StreamEvent>` → `RelayAdapter.sendMessage` yields from it ✓
- `RelayAdapter` constructor: `(agent: Agent, getSecret: () => Promise<string | null>)` → matches `makeAdapter` call signature ✓
- `AnyFrame` imported in relay from `../../protocol/protocol`, in app from `@/agents/relay/types` ✓
- `makeAdapter` transport check added before framework switch → direct mode adapters unchanged ✓
