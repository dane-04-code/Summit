/**
 * Seeded opening thread — reproduces the Agent Messenger design's conversation
 * (cluster-status exchange → deploy request → approval card). Replaced by real
 * session history once Hermes streaming lands.
 * ponytail: drop this seed when hermes session restore is wired.
 */

import type { Message, ChatGroup } from './types';

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
    title: 'Run a shell command on the production host?',
    command: './deploy.sh api --prod',
  },
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
