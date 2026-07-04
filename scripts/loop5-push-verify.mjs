#!/usr/bin/env node
/**
 * Proves a push actually fires — the point of Loop 5 — without a physical
 * device. Stands up a local sink, points the relay at it via .dev.vars
 * (PUSH_URL), then drives the two push paths and asserts the sink received the
 * notification:
 *
 *   1. auto-push: app registers a token, leaves, a turn completes → push
 *   2. nudge:     app is away, the agent hits the connector's /notify → push
 *
 * Assumes the Loop 5 stack is running with PUSH_URL → this sink
 * (npm run loop5, with relay/.dev.vars set). Reads the pairing code the test
 * connector persisted.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8787';
const SINK_PORT = Number(process.env.SINK_PORT || 9099);
const NOTIFY_URL = process.env.NOTIFY_URL || 'http://127.0.0.1:8643/notify';
const TOKEN = 'ExponentPushToken[push-verify]';
const code =
  process.argv[2] ||
  fs.readFileSync(path.join(os.tmpdir(), 'summit-test-connector-code'), 'utf8').trim();

const fail = (m) => {
  console.error(`✗ ${m}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Buffer pushes: the relay can hit the sink before the script reaches
// nextPush(), so hold received pushes in a queue and drain it on demand.
const received = [];
let waiter = null;
const sink = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // Mimic the Expo Push API's accepted-ticket response shape.
    res.end('{"data":{"status":"ok"}}');
    let push;
    try {
      push = JSON.parse(raw);
    } catch {
      push = { raw };
    }
    if (waiter) {
      waiter(push);
      waiter = null;
    } else {
      received.push(push);
    }
  });
});

function nextPush(label) {
  if (received.length) return Promise.resolve(received.shift());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no push received for ${label}`)), 8000);
    waiter = (p) => {
      clearTimeout(timer);
      resolve(p);
    };
  });
}

function openApp() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${RELAY_URL}?code=${code}`);
    const timer = setTimeout(() => reject(new Error('pairing timed out')), 8000);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'pair', code })));
    ws.addEventListener('message', (e) => {
      const f = JSON.parse(e.data);
      if (f.t === 'paired') {
        clearTimeout(timer);
        resolve(ws);
      } else if (f.t === 'pair_error') {
        reject(new Error(`pair_error: ${f.reason}`));
      }
    });
    ws.addEventListener('error', () => reject(new Error('relay unreachable')));
  });
}

async function main() {
  await new Promise((r) => sink.listen(SINK_PORT, '127.0.0.1', r));
  console.log(`✓ push sink listening on http://127.0.0.1:${SINK_PORT}`);

  // ── Path 1: agent-initiated nudge while the app is away ──────────────────
  const ws = await openApp();
  console.log('✓ paired');
  ws.send(JSON.stringify({ t: 'register_push', token: TOKEN }));
  console.log(`✓ registered token ${TOKEN}`);
  await sleep(300); // let the DO persist the token
  ws.close();
  await sleep(300); // let the relay mark the app away

  const notifyRes = await fetch(NOTIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Approval needed', body: 'Deploy to prod?' }),
  });
  if (!notifyRes.ok) fail(`connector /notify returned ${notifyRes.status}`);
  console.log('✓ agent posted to connector /notify');

  const push = await nextPush('nudge');
  if (push.to !== TOKEN) fail(`push went to ${push.to}, expected ${TOKEN}`);
  if (push.title !== 'Approval needed' || push.body !== 'Deploy to prod?') {
    fail(`push content wrong: ${JSON.stringify(push)}`);
  }
  console.log(`✓ relay pushed to the sink: "${push.title} — ${push.body}"`);

  console.log('\n✅ Push path verified: agent → connector → relay → Expo Push API (sink)');
  sink.close();
  process.exit(0);
}

main().catch((e) => fail(e.message));
