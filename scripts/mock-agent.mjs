#!/usr/bin/env node
/**
 * Mock agent server for tester loops — no dependencies, plain Node.
 *
 * Generic mode (default): speaks the OpenAI-compatible surface Summit's Tier 2
 * adapter uses — GET /v1/models, POST /v1/chat/completions (SSE).
 *
 *   node scripts/mock-agent.mjs                 # generic, port 8642
 *   node scripts/mock-agent.mjs --port 11434    # pretend to be Ollama
 *
 * Hermes mode (--hermes): adds the Hermes native surface — /v1/capabilities,
 * /health, the Jobs API (with live pause/resume state), runs approval/stop,
 * session headers echoed to the console, and a hermes.tool.progress SSE event.
 *
 *   node scripts/mock-agent.mjs --hermes
 *   node scripts/mock-agent.mjs --hermes --key sk-test   # enforce Bearer auth
 *
 * Loops this enables (see docs/TESTING.md):
 *   direct:  app Connect screen → this server
 *   relay:   connector (HERMES_BASE_URL=http://localhost:8642) → relay → app
 */

import http from 'node:http';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const HERMES = flag('hermes');
const PORT = Number(opt('port', 8642));
const KEY = opt('key', null);
const MODEL = opt('model', HERMES ? 'hermes-agent' : 'mock-model');

// ── In-memory Hermes jobs (pause/resume/run actually mutate) ────────────────

const jobs = new Map(
  [
    {
      id: 'daily-digest',
      name: 'Daily digest',
      cron: '0 8 * * *',
      state: 'scheduled',
      last_status: 'ok',
      last_run_at: new Date(Date.now() - 3 * 3600e3).toISOString(),
      next_run_at: new Date(Date.now() + 5 * 3600e3).toISOString(),
      prompt: 'Summarize overnight activity.',
    },
    {
      id: 'repo-watch',
      name: 'Repo watch',
      cron: '*/30 * * * *',
      state: 'paused',
      last_status: 'error',
      last_run_at: new Date(Date.now() - 26 * 3600e3).toISOString(),
      next_run_at: null,
      prompt: 'Check CI and open PRs.',
    },
  ].map((j) => [j.id, j]),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

function unauthorized(res) {
  json(res, 401, { error: { message: 'Invalid API key' } });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The canned reply — markdown-rich to exercise the renderer. */
function replyFor(userText) {
  return [
    `Got it — you said **“${userText.slice(0, 120)}”**.\n\n`,
    `Here's a taste of everything the thread should render:\n\n`,
    `## A heading\n\n`,
    `- a bullet with \`inline code\`\n- another bullet\n\n`,
    `\`\`\`ts\nconst answer = 42;\n\`\`\`\n\n`,
    `That's the whole loop: phone → ${HERMES ? 'Hermes' : 'OpenAI-compatible'} mock → phone. `,
    `Streamed at ${new Date().toLocaleTimeString()}.`,
  ].join('');
}

async function streamCompletion(req, res, body) {
  const userText =
    [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')?.content ?? '(no message)';

  if (HERMES) {
    const sid = req.headers['x-hermes-session-id'];
    const skey = req.headers['x-hermes-session-key'];
    if (sid || skey) console.log(`  session id=${sid ?? '-'} key=${skey ?? '-'}`);
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const send = (data) => res.write(`data: ${data}\n\n`);
  const delta = (text) =>
    send(JSON.stringify({ id: 'mock', object: 'chat.completion.chunk', choices: [{ delta: { content: text } }] }));

  if (HERMES) {
    res.write(`event: hermes.tool.progress\ndata: ${JSON.stringify({ label: 'Thinking about it' })}\n\n`);
    await sleep(300);
  }

  // Stream in small chunks so the UI's streaming path is actually exercised.
  const full = replyFor(String(userText));
  for (let i = 0; i < full.length; i += 8) {
    delta(full.slice(i, i + 8));
    await sleep(24);
  }
  send('[DONE]');
  res.end();
}

// ── Routes ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  console.log(`${req.method} ${path}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    return res.end();
  }

  if (KEY && req.headers.authorization !== `Bearer ${KEY}`) {
    return unauthorized(res);
  }

  // Generic OpenAI-compatible surface (both modes)
  if (req.method === 'GET' && path === '/v1/models') {
    return json(res, 200, { object: 'list', data: [{ id: MODEL, object: 'model' }] });
  }
  if (req.method === 'POST' && path === '/v1/chat/completions') {
    const body = await readBody(req);
    if (body.stream) return streamCompletion(req, res, body);
    return json(res, 200, {
      id: 'mock',
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: replyFor('non-streaming request') } }],
    });
  }

  // Hermes native surface
  if (HERMES) {
    if (req.method === 'GET' && path === '/v1/capabilities') {
      return json(res, 200, {
        object: 'capabilities',
        platform: 'mock',
        features: {
          chat_completions: true,
          run_approval: true,
          run_stop: true,
          run_submission: true,
          responses_api: true,
        },
      });
    }
    if (req.method === 'GET' && path === '/health') {
      return json(res, 200, { status: 'ok' });
    }
    if (req.method === 'GET' && path === '/api/jobs') {
      return json(res, 200, { jobs: [...jobs.values()] });
    }
    const jobMatch = path.match(/^\/api\/jobs\/([^/]+)(?:\/(run|pause|resume))?$/);
    if (jobMatch && jobs.has(jobMatch[1])) {
      const job = jobs.get(jobMatch[1]);
      const action = jobMatch[2];
      if (req.method === 'GET' && !action) {
        return json(res, 200, {
          ...job,
          latest_run: { at: job.last_run_at, status: job.last_status, result: 'Mock run output.' },
        });
      }
      if (req.method === 'POST' && action === 'pause') {
        job.state = 'paused';
        job.next_run_at = null;
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && action === 'resume') {
        job.state = 'scheduled';
        job.next_run_at = new Date(Date.now() + 3600e3).toISOString();
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && action === 'run') {
        job.last_run_at = new Date().toISOString();
        job.last_status = 'ok';
        return json(res, 200, { ok: true });
      }
    }
    if (req.method === 'POST' && /^\/v1\/runs\/[^/]+\/(approval|stop)$/.test(path)) {
      return json(res, 200, { ok: true });
    }
  }

  json(res, 404, { error: { message: `No route for ${req.method} ${path}` } });
});

server.listen(PORT, () => {
  console.log(
    `Mock ${HERMES ? 'Hermes' : 'OpenAI-compatible'} agent on http://localhost:${PORT}` +
      (KEY ? ` (Bearer ${KEY})` : ' (no auth)'),
  );
  console.log(
    HERMES
      ? 'Surface: /v1/capabilities, /v1/chat/completions (SSE), /health, /api/jobs, /v1/runs'
      : 'Surface: /v1/models, /v1/chat/completions (SSE)',
  );
});
