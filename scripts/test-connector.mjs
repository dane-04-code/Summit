#!/usr/bin/env node
/**
 * Test connector — a Node port of the Go connector (connector/) for tester
 * loops on machines without a Go toolchain. It is NOT what ships; the Go
 * connector is. This exists so Loop 5 (docs/TESTING.md) runs anywhere Node
 * does, and it speaks the exact same relay protocol (protocol/protocol.ts).
 *
 * It dials the relay outbound, prints the 6-digit pairing code, proxies chat
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

function savedCode() {
  try {
    return fs.readFileSync(CODE_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function saveCode(code) {
  try {
    fs.writeFileSync(CODE_FILE, code + '\n');
  } catch {
    /* best effort */
  }
}

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
  const target = code ? `${RELAY_URL}?claim=${code}` : RELAY_URL;
  ws = new WebSocket(target);

  ws.addEventListener('open', () => {
    console.log(`[connector] connected to relay ${RELAY_URL}`);
    send({ t: 'hello', framework: FRAMEWORK, agentName: AGENT_NAME, agentVersion: '1.0' });
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
        saveCode(frame.code);
        console.log(
          `\n┌──────────────────────────┐\n│   Pairing code: ${String(frame.code).padEnd(6)}   │\n└──────────────────────────┘\n\nEnter this code in the Summit app.\n`,
        );
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
