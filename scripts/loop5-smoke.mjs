#!/usr/bin/env node
/**
 * Scripted app for verifying the Loop 5 stack without a phone. Connects to the
 * local relay as the app would, pairs, registers a push token, sends one chat,
 * and asserts the reply streams back through connector → relay → app.
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

const ws = new WebSocket(`${RELAY_URL}?code=${code}`);
const chunks = [];
let paired = false;

const timer = setTimeout(() => fail('timed out waiting for a reply'), 15000);

ws.addEventListener('open', () => {
  ws.send(JSON.stringify({ t: 'pair', code }));
});

ws.addEventListener('message', (event) => {
  const frame = JSON.parse(event.data);
  switch (frame.t) {
    case 'paired':
      paired = true;
      console.log(`✓ paired — framework=${frame.framework} name=${frame.agentName}`);
      ws.send(JSON.stringify({ t: 'register_push', token: 'ExponentPushToken[smoke]', mode: 'all' }));
      console.log('✓ registered push token');
      ws.send(
        JSON.stringify({ t: 'chat', reqId: 's1', messages: [{ role: 'user', content: 'ping' }] }),
      );
      break;
    case 'chunk':
      chunks.push(frame.delta);
      break;
    case 'done': {
      clearTimeout(timer);
      const text = chunks.join('');
      if (!paired) fail('never paired');
      if (text.length === 0) fail('reply was empty');
      console.log(`✓ streamed ${chunks.length} chunks (${text.length} chars)`);
      console.log(`✓ reply preview: ${text.slice(0, 60).replace(/\n/g, ' ')}…`);
      console.log('\n✅ Loop 5 stack verified: app ↔ relay ↔ connector ↔ mock agent');
      ws.close();
      process.exit(0);
      break;
    }
    case 'pair_error':
      fail(`pair_error: ${frame.reason}`);
      break;
    case 'error':
      fail(`error frame: ${frame.message}`);
      break;
  }
});

ws.addEventListener('error', () => fail(`could not reach relay at ${RELAY_URL}`));
