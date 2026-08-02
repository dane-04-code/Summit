#!/usr/bin/env node
/**
 * Scripted app for verifying the Loop 5 stack without a phone. Connects to the
 * local relay as the app would, pairs, reconnects authenticated, registers a
 * push token, sends one chat, and asserts the reply streams back through
 * connector → relay → app.
 *
 * Usage: node scripts/loop5-smoke.mjs <code>   (code defaults to the file the
 * test connector persists).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8787';
const codeArg = process.argv[2];
const code =
  codeArg ||
  fs.readFileSync(path.join(os.tmpdir(), 'summit-test-connector-code'), 'utf8').trim();

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

/** Pair on the first socket, exactly as pair.tsx does. */
function pair() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${RELAY_URL}?code=${encodeURIComponent(code)}`);
    const timer = setTimeout(() => reject(new Error('pairing timed out')), 8000);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'pair', code })));
    ws.addEventListener('message', (e) => {
      const f = JSON.parse(e.data);
      if (f.t === 'paired') {
        clearTimeout(timer);
        resolve({ ws, paired: f });
      } else if (f.t === 'pair_error') {
        clearTimeout(timer);
        reject(new Error(`pair_error: ${f.reason}`));
      }
    });
    ws.addEventListener('error', () => reject(new Error(`could not reach relay at ${RELAY_URL}`)));
  });
}

/**
 * The pairing socket is tagged unauthenticated — only `resume` with the
 * sessionToken earns the `authenticated` tag, and the relay rejects chat frames
 * without it. So the app drops that socket and opens a second one; this script
 * must too, or the round-trip dies on "Relay authentication required."
 */
function resumeAuthenticated(sessionToken) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${RELAY_URL}?code=${encodeURIComponent(code)}&token=${encodeURIComponent(sessionToken)}`,
    );
    const timer = setTimeout(() => reject(new Error('resume timed out')), 8000);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'resume', token: sessionToken })));
    ws.addEventListener('message', (e) => {
      const f = JSON.parse(e.data);
      if (f.t === 'paired') {
        clearTimeout(timer);
        resolve(ws);
      } else if (f.t === 'pair_error' || f.t === 'peer_gone') {
        clearTimeout(timer);
        reject(new Error(`resume failed: ${f.reason ?? f.t}`));
      }
    });
    ws.addEventListener('error', () => reject(new Error('relay unreachable')));
  });
}

/** One chat turn; resolves with the chunks that came back for this reqId. */
function chat(ws, { reqId, sessionId, text }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => reject(new Error('timed out waiting for a reply')), 15000);
    const onMessage = (e) => {
      const f = JSON.parse(e.data);
      if (f.reqId && f.reqId !== reqId) return;
      if (f.t === 'chunk') chunks.push(f);
      if (f.t === 'error') {
        clearTimeout(timer);
        ws.removeEventListener('message', onMessage);
        reject(new Error(`error frame: ${f.message}`));
      }
      if (f.t === 'done') {
        clearTimeout(timer);
        ws.removeEventListener('message', onMessage);
        resolve({ chunks, done: f });
      }
    };
    ws.addEventListener('message', onMessage);
    ws.send(
      JSON.stringify({
        t: 'chat',
        reqId,
        sessionId,
        sessionKey: `key-${sessionId}`,
        messages: [{ role: 'user', content: text }],
      }),
    );
  });
}

async function main() {
  const { ws: pairingWs, paired } = await pair();
  console.log(`✓ paired — framework=${paired.framework} name=${paired.agentName}`);
  pairingWs.close();

  const ws = await resumeAuthenticated(paired.sessionToken);
  console.log('✓ resumed on an authenticated connection');

  ws.send(JSON.stringify({ t: 'register_push', token: 'ExponentPushToken[smoke]', mode: 'all' }));
  console.log('✓ registered push token');

  const { chunks, done } = await chat(ws, { reqId: 's1', sessionId: 'smoke-A', text: 'ping' });
  const text = chunks.map((c) => c.delta).join('');
  if (chunks.length === 0 || text.length === 0) fail('reply was empty');
  const stray = chunks.find((c) => c.sessionId && c.sessionId !== 'smoke-A');
  if (stray) fail(`chunk carried a foreign sessionId: ${stray.sessionId}`);
  if (done.sessionId && done.sessionId !== 'smoke-A') fail(`done carried ${done.sessionId}`);
  console.log(`✓ streamed ${chunks.length} chunks (${text.length} chars)`);
  console.log(`✓ reply preview: ${text.slice(0, 60).replace(/\n/g, ' ')}…`);

  // A second thread on the same agent must not inherit the first one's stream.
  const second = await chat(ws, { reqId: 's2', sessionId: 'smoke-B', text: 'second' });
  const leaked = second.chunks.filter((c) => c.sessionId && c.sessionId !== 'smoke-B');
  if (leaked.length) fail(`${leaked.length} chunks leaked from another session`);
  console.log(`✓ a second session stays isolated (${second.chunks.length} chunks)`);

  console.log('\n✅ Loop 5 stack verified: app ↔ relay ↔ connector ↔ mock agent');
  ws.close();
  process.exit(0);
}

main().catch((e) => fail(e.message));
