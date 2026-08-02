#!/usr/bin/env node
/**
 * Test connector — a Node port of the Go connector (connector/) for tester
 * loops on machines without a Go toolchain. It is NOT what ships; the Go
 * connector is. This exists so Loop 5 (docs/TESTING.md) runs anywhere Node
 * does, and it speaks the exact same relay protocol (protocol/protocol.ts).
 *
 * It dials the relay outbound, prints the pairing code, proxies chat
 * (SSE) and allow-listed REST calls to the upstream agent, and exposes a
 * loopback /notify endpoint so the agent-initiated push path is testable:
 *
 *   curl -s localhost:8643/notify -d '{"title":"Approval needed","body":"Deploy?"}'
 *
 * Env: RELAY_URL (default ws://localhost:8787), HERMES_BASE_URL
 * (default http://localhost:8642), HERMES_API_KEY, AGENT_FRAMEWORK
 * (default hermes), AGENT_NAME, NOTIFY_PORT (default 8643).
 *
 * Node built-ins only — global WebSocket + fetch (Node 22+), http, fs, os.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8787';
const HERMES_BASE = (process.env.HERMES_BASE_URL || 'http://localhost:8642').replace(/\/+$/, '');
const API_KEY = process.env.HERMES_API_KEY || 'x';
const FRAMEWORK = (process.env.AGENT_FRAMEWORK || 'hermes').toLowerCase();
const AGENT_NAME = process.env.AGENT_NAME || (FRAMEWORK === 'hermes' ? 'Hermes' : 'Agent');
const NOTIFY_PORT = Number(process.env.NOTIFY_PORT || 8643);

const CODE_FILE = path.join(os.tmpdir(), 'summit-test-connector-code');
// The relay hands back a connector token with the code and, from then on,
// rejects a reclaim that can't present it (relay/src/channel.ts). Mirrors the
// Go connector's `connector_token` file — without it a reclaim 401-loops
// forever and the only cure is deleting the code file by hand.
const TOKEN_FILE = path.join(os.tmpdir(), 'summit-test-connector-token');

function readFile(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

const savedCode = () => readFile(CODE_FILE);
const savedToken = () => readFile(TOKEN_FILE);

function saveIdentity(code, token) {
  try {
    fs.writeFileSync(CODE_FILE, code + '\n');
    // A `code` frame without a token means an older relay; keep what we have
    // rather than blanking a token that still works.
    if (token) fs.writeFileSync(TOKEN_FILE, token + '\n');
  } catch {
    /* best effort */
  }
}

/** Drop the saved channel so the next dial mints a fresh code. Only for a code
 *  that lapsed before anyone paired — clearing a paired one orphans the phone. */
function clearIdentity() {
  try {
    fs.rmSync(CODE_FILE, { force: true });
    fs.rmSync(TOKEN_FILE, { force: true });
  } catch {
    /* best effort */
  }
}

/** Display form — K7M29XQP reads as K7M2-9XQP. Mirror of formatPairingCode in
 *  /protocol/pairingCode.ts; the wire form is always unhyphenated. */
function formatCode(code) {
  const s = String(code);
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

/** Pending code rotation, cleared the moment a phone pairs. */
let rotateTimer;

/** Allow-list mirrors connector/hermes.go — the trust boundary. */
const API_ALLOW = [
  { method: 'GET', re: /^\/api\/jobs$/ },
  { method: 'GET', re: /^\/api\/jobs\/[^/]+$/ },
  { method: 'POST', re: /^\/api\/jobs\/[^/]+\/(run|pause|resume)$/ },
  { method: 'POST', re: /^\/v1\/runs\/[^/]+\/(approval|stop)$/ },
  { method: 'GET', re: /^\/v1\/capabilities$/ },
  { method: 'GET', re: /^\/health$/ },
];
const apiAllowed = (method, p) => API_ALLOW.some((a) => a.method === method && a.re.test(p));

let ws = null;
let heartbeat = null;

function send(frame) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

// ── Upstream proxying ────────────────────────────────────────────────────────

async function streamChat(frame) {
  const { reqId, messages, sessionId, sessionKey } = frame;
  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    };
    if (sessionId) headers['X-Hermes-Session-Id'] = sessionId;
    if (sessionKey) headers['X-Hermes-Session-Key'] = sessionKey;

    const res = await fetch(`${HERMES_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: FRAMEWORK, messages, stream: true }),
    });
    if (!res.ok || !res.body) {
      const body = res.body ? await res.text() : '';
      send({ t: 'error', reqId, message: `agent ${res.status}: ${body.slice(0, 120)}` });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          send({ t: 'done', reqId });
          return;
        }
        try {
          const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
          if (delta) send({ t: 'chunk', reqId, delta });
        } catch {
          /* keep-alive frame */
        }
      }
    }
    send({ t: 'done', reqId });
  } catch (err) {
    send({ t: 'error', reqId, message: String(err?.message ?? err) });
  }
}

async function handleApiReq(frame) {
  const { reqId, method, path: p, body } = frame;
  if (!apiAllowed(method, p)) {
    send({ t: 'api_res', reqId, status: 403, body: '{"error":"path not allowed"}' });
    return;
  }
  try {
    const res = await fetch(`${HERMES_BASE}${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: body || undefined,
    });
    send({ t: 'api_res', reqId, status: res.status, body: await res.text() });
  } catch (err) {
    send({ t: 'api_res', reqId, status: 502, body: `{"error":${JSON.stringify(String(err))}}` });
  }
}

// ── Relay connection ─────────────────────────────────────────────────────────

function connect() {
  const code = savedCode();
  const token = code ? savedToken() : null;
  let target = RELAY_URL;
  if (code) {
    target += `?claim=${encodeURIComponent(code)}`;
    if (token) target += `&token=${encodeURIComponent(token)}`;
  }
  ws = new WebSocket(target);

  let opened = false;

  ws.addEventListener('open', () => {
    opened = true;
    console.log(`[connector] connected to relay ${RELAY_URL}`);
    send({
      t: 'hello',
      framework: FRAMEWORK,
      agentName: AGENT_NAME,
      agentVersion: '1.0',
      // Mirrors the Go connector: promising rotation is what earns the short
      // code TTL, so tester loops exercise the same window real users get.
      capabilities: ['code_rotation'],
    });
    clearInterval(heartbeat);
    heartbeat = setInterval(() => send({ t: 'ping' }), 30000);
  });

  ws.addEventListener('message', (event) => {
    let frame;
    try {
      frame = JSON.parse(event.data);
    } catch {
      return;
    }
    switch (frame.t) {
      case 'code':
        saveIdentity(frame.code, frame.connectorToken);
        clearTimeout(rotateTimer);
        if (frame.paired) {
          console.log('[connector] already paired — waiting for messages');
          break;
        }
        console.log(
          `\n┌────────────────────────────┐\n│  Pairing code: ${formatCode(frame.code).padEnd(9)}   │\n└────────────────────────────┘\n\nEnter this code in the Summit app.\n`,
        );
        if (frame.expiresAt) {
          rotateTimer = setTimeout(() => {
            console.log('[connector] code expired unused — fetching a fresh one');
            clearIdentity();
            ws.close(); // the close handler redials, this time without a claim
          }, Math.max(5000, frame.expiresAt - Date.now()));
        }
        break;
      case 'pair_ok':
        clearTimeout(rotateTimer);
        console.log('[connector] paired with the app');
        break;
      case 'chat':
        void streamChat(frame);
        break;
      case 'api_req':
        void handleApiReq(frame);
        break;
      case 'peer_gone':
        console.log('[connector] app disconnected — waiting for reconnect');
        break;
      case 'pong':
        break;
      default:
        break;
    }
  });

  ws.addEventListener('close', () => {
    clearInterval(heartbeat);
    // Never upgraded while presenting a claim: the relay refused this channel
    // (stale token, or its Durable Object storage was wiped by a `wrangler dev`
    // restart). Retrying the same claim loops forever, so drop it and mint a
    // fresh code — the phone can't be served by a channel we're locked out of.
    if (!opened && code) {
      console.log('[connector] relay rejected the saved channel — minting a fresh code');
      clearIdentity();
    }
    console.log('[connector] relay closed — reconnecting in 3s');
    setTimeout(connect, 3000);
  });

  ws.addEventListener('error', () => {
    // 'close' follows and owns the reconnect.
  });
}

// ── Loopback notify endpoint (agent-initiated nudge) ─────────────────────────

function startNotifyServer() {
  http
    .createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST' || req.url !== '/notify') {
        res.writeHead(404).end('{"error":"POST /notify only"}');
        return;
      }
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        let body = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          res.writeHead(400).end('{"error":"body must be JSON"}');
          return;
        }
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          res.writeHead(503).end('{"error":"relay not connected"}');
          return;
        }
        send({
          t: 'notify',
          title: String(body.title ?? '').slice(0, 256),
          body: String(body.body ?? '').slice(0, 256),
        });
        res.writeHead(200).end('{"ok":true}');
      });
    })
    .listen(NOTIFY_PORT, '127.0.0.1', () => {
      console.log(`[connector] notify endpoint on http://127.0.0.1:${NOTIFY_PORT}/notify`);
    });
}

console.log(
  `[connector] ${AGENT_NAME} (${FRAMEWORK}) → relay ${RELAY_URL}, upstream ${HERMES_BASE}`,
);
startNotifyServer();
connect();
