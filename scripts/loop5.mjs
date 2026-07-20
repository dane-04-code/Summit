#!/usr/bin/env node
/**
 * One-command Loop 5 (docs/TESTING.md) — stands up the push-notification test
 * stack and prints the pairing code.
 *
 *   node scripts/loop5.mjs            # fully local: mock + wrangler dev + connector
 *   node scripts/loop5.mjs --cloud    # mock + connector dialing the prod relay
 *
 * Local mode verifies the whole pipe on one machine. Cloud mode is for testing
 * with a real phone: the connector dials wss://relay.summitapp.dev (already
 * deployed with the push logic), so the phone never needs to reach this PC —
 * The app defaults to production. For fully local app testing, start Expo with
 *   EXPO_PUBLIC_RELAY_URL=ws://localhost:8787 npx expo start
 *
 * Ctrl+C tears everything down.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloud = process.argv.includes('--cloud');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELAY_PORT = 8787;
const RELAY_URL = cloud ? 'wss://relay.summitapp.dev' : `ws://localhost:${RELAY_PORT}`;

const children = [];
let shuttingDown = false;

/** Spawn a child, prefixing its stdout/stderr so the streams don't tangle. */
function run(label, command, args, opts = {}) {
  const child = spawn(command, args, {
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...opts.env },
    shell: process.platform === 'win32', // resolve npx/npm.cmd on Windows
  });
  const prefix = (line) => line && console.log(`\x1b[2m[${label}]\x1b[0m ${line}`);
  child.stdout.on('data', (d) => String(d).split('\n').forEach(prefix));
  child.stderr.on('data', (d) => String(d).split('\n').forEach(prefix));
  child.on('exit', (code) => {
    if (!shuttingDown) console.log(`\x1b[2m[${label}]\x1b[0m exited (${code})`);
  });
  children.push(child);
  return child;
}

function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error(`port ${port} never opened`));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[loop5] shutting down…');
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  console.log(`[loop5] ${cloud ? 'cloud' : 'local'} mode — relay ${RELAY_URL}\n`);

  run('mock', 'node', ['scripts/mock-agent.mjs', '--hermes']);

  if (!cloud) {
    run('relay', 'npx', ['wrangler', 'dev', '--port', String(RELAY_PORT)], {
      cwd: path.join(root, 'relay'),
    });
    console.log('[loop5] waiting for the relay to come up…');
    await waitForPort(RELAY_PORT);
    console.log('[loop5] relay is up.\n');
  }

  run('connector', 'node', ['scripts/test-connector.mjs'], {
    env: {
      RELAY_URL,
      HERMES_BASE_URL: 'http://localhost:8642',
      HERMES_API_KEY: 'x',
      AGENT_FRAMEWORK: 'hermes',
    },
  });
}

main().catch((err) => {
  console.error('[loop5]', err.message);
  shutdown();
});
