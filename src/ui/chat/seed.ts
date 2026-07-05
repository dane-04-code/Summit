/**
 * Seeded opening thread — reproduces the Summit design's conversation
 * (cluster-status exchange → deploy request → approval card). Replaced by real
 * session history once Hermes streaming lands.
 * ponytail: drop this seed when hermes session restore is wired.
 */

import type { Message, ChatGroup, MarkdownFile } from './types';

/**
 * The markdown file the agent "wrote" — rendered collapsed in the thread and
 * expanded in the reader. Source matches the MD File design; `sizeLabel` and
 * `lineCount` are the design's meta (the source is an excerpt of a longer doc).
 * ponytail: replace with the real file the agent returns once files land.
 */
const RESEARCH_SOURCE = `---
title: Trades Market Research
author: Hermes
date: 2026-06-28
---

# Trades Market Research

Five UK trades ranked by lead value and the gap each one has online. Builders carry the highest project value; painters convert fastest.

## Top opportunities

| Trade | Lead £ |
| --- | --- |
| Builder | 15,000 |
| Landscaper | 4,500 |
| Electrician | 2,500 |

## Recommendation

- Lead with **builders** — highest value, weakest web presence.
- Ship a portfolio template with built-in reviews.
- Remove booking friction for plumbers next.

> The best marketing tool for a tradesman is a customer they can point to and say 'I did that.'
>
> — Dane, probably
`;

export const RESEARCH_FILE: MarkdownFile = {
  name: 'trades-market-research.md',
  sizeLabel: '12 KB',
  lineCount: 240,
  source: RESEARCH_SOURCE,
};

// ── Rich-rendering showcase sources (Rich Rendering design, frames 1–4) ──────
// These exercise the markdown renderer: inline styles, task lists, code +
// syntax highlighting, math, tables, link chips, and a blockquote.

const MD_FORMATTING = `**Bold**, *italic*, ~~strikethrough~~, \`inline code\`, and ==highlighted== text.

## This week

- [x] SEO free-tools audit
- [x] Facebook Pixel wired on MyTradeLink
- [ ] Push Stripe test-mode end-to-end
- [ ] Daydreamer creative brief
- [!] GitHub deploy key`;

const MD_CODE_MATH = `Here's a compact generator:

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    while a < n:
        print(a, end=' ')
        a, b = b, a + b
    return a
# 0 1 1 2 3 5 8 13 …
\`\`\`

Inline math like $E = mc^2$ renders too. The roots of $ax^2 + bx + c$:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$`;

const MD_TABLE = `Here's the market snapshot:

| Trade | Jobs | Lead £ |
| --- | ---: | ---: |
| Electrician | 12–15 | 2,500 |
| Plumber | 10–12 | 2,000 |
| Builder | 3–5 | 15,000 |
| Landscaper | 6–8 | 4,500 |
| Painter | 8–10 | 1,200 |

Builder leads carry the highest project value. Sources:

[MyTradeLink](https://mytradelink.example) [Hermes Docs](https://hermes.example) [github.com](https://github.com)`;

const MD_QUOTE = `Pipeline snapshot from the last briefing — three workstreams active, two queued.

> The best marketing tool for a tradesman is a customer they can point to and say 'I did that.'
>
> — Dane, probably`;

export const SEED_THREAD: Message[] = [
  {
    id: 'seed-u1',
    role: 'user',
    text: "What's the status of the cluster?",
  },
  {
    id: 'seed-a1',
    role: 'agent',
    blocks: [
      { kind: 'heading', text: 'Cluster status' },
      {
        kind: 'text',
        spans: [
          {
            text:
              "Three services are live. The worker pool went down a few minutes ago — here's the snapshot:",
          },
        ],
      },
      {
        kind: 'table',
        rows: [
          { service: 'api', state: 'running', statusLabel: 'running', p95: '142ms' },
          { service: 'web', state: 'idle', statusLabel: 'idle', p95: '88ms' },
          { service: 'worker', state: 'error', statusLabel: 'error', p95: '—' },
        ],
      },
      {
        kind: 'code',
        lines: [
          { segments: [{ text: '$ hermes logs worker --tail 1' }] },
          {
            segments: [
              { text: 'ERR', tone: 'error' },
              { text: ' pool exited: connection refused (:6432)' },
            ],
          },
        ],
      },
      {
        kind: 'text',
        tone: 'muted',
        spans: [
          { text: 'Postgres on the worker box is unreachable. Want me to redeploy it?' },
        ],
      },
    ],
  },
  {
    id: 'seed-u2',
    role: 'user',
    text: 'Yes — redeploy the api service.',
  },
  {
    id: 'seed-a2',
    role: 'agent',
    blocks: [
      {
        kind: 'text',
        spans: [
          { text: 'On it — redeploying ' },
          { text: 'api', code: true },
          { text: ' now.' },
        ],
      },
      { kind: 'chip', state: 'running', label: 'running deploy.sh…' },
    ],
  },
  {
    id: 'seed-action',
    role: 'action',
    runId: 'seed-run',
    title: 'Run a shell command on the production host?',
    command: './deploy.sh api --prod',
  },
  {
    id: 'seed-u3',
    role: 'user',
    text: 'Can you save that research as a doc?',
  },
  {
    id: 'seed-a3',
    role: 'agent',
    blocks: [
      { kind: 'text', spans: [{ text: 'Done — wrote it to a Markdown file:' }] },
      { kind: 'file', file: RESEARCH_FILE },
    ],
  },

  { id: 'seed-u4', role: 'user', text: 'Show me every text style you support.' },
  { id: 'seed-a4', role: 'agent', blocks: [{ kind: 'markdown', source: MD_FORMATTING }] },

  { id: 'seed-u5', role: 'user', text: 'Fibonacci snippet, and the quadratic formula.' },
  { id: 'seed-a5', role: 'agent', blocks: [{ kind: 'markdown', source: MD_CODE_MATH }] },

  { id: 'seed-u6', role: 'user', text: 'Compare the trades by opportunity.' },
  { id: 'seed-a6', role: 'agent', blocks: [{ kind: 'markdown', source: MD_TABLE }] },

  { id: 'seed-u7', role: 'user', text: 'Where are we on the roadmap?' },
  { id: 'seed-a7', role: 'agent', blocks: [{ kind: 'markdown', source: MD_QUOTE }] },
];

/** Id of the conversation currently open in the thread (the seeded one). */
export const ACTIVE_CHAT_ID = 'cluster-status';

/**
 * Seeded sidebar recents — mirrors the design's conversation list.
 * ponytail: replace with real session history when Hermes session list lands.
 */
export const RECENT_CHATS: ChatGroup[] = [
  {
    label: 'Today',
    chats: [
      { id: 'cluster-status', title: 'Cluster status', preview: 'Redeploying api now…', time: 'now', state: 'running' },
      { id: 'refactor-billing', title: 'Refactor billing module', preview: 'Extracted the invoice service', time: '2h', state: 'idle' },
      { id: 'draft-launch-email', title: 'Draft launch email', preview: 'Tightened the subject line', time: '4h', state: 'idle' },
    ],
  },
  {
    label: 'Yesterday',
    chats: [
      { id: 'postgres-migration', title: 'Postgres migration plan', preview: 'Failed: connection refused', time: 'Tue', state: 'error' },
      { id: 'weekend-trip', title: 'Weekend trip itinerary', preview: 'Booked the 9:40 train', time: 'Tue', state: 'idle' },
    ],
  },
  {
    label: 'Previous 7 days',
    chats: [
      { id: 'resume-review', title: 'Resume review', preview: 'Three phrasing suggestions', time: 'Sat', state: 'idle' },
      { id: 'learn-rust', title: 'Learn Rust ownership', preview: 'Borrow checker, explained', time: 'Fri', state: 'idle' },
    ],
  },
];

/** Signed-in account shown in the sidebar footer. */
export const ACCOUNT = { name: 'Alex Rivera', initial: 'A' };
