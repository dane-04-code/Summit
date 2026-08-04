import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SettledReply } from './protocol';

/**
 * A small acknowledged queue of settled turns, ported from connector/outbox.go.
 *
 * This is the reason a phone that was off during a long run still gets the
 * answer: the app asks for `sync_req` on reconnect and only acknowledges what
 * it has persisted. The plugin restarting with the Gateway makes the disk
 * backing more important here than it was in the connector, not less.
 *
 * The file holds transcript text, so it stays on the user's host and is written
 * owner-only.
 */
const MAX_PENDING_REPLIES = 100;

export type ReplyOutbox = {
  add: (reply: Omit<SettledReply, 'id' | 'createdAt'> & Partial<Pick<SettledReply, 'id' | 'createdAt'>>) => SettledReply;
  list: () => SettledReply[];
  ack: (ids: string[]) => void;
};

function load(path: string): SettledReply[] {
  try {
    const raw = readFileSync(path, 'utf8');
    if (raw.trim() === '') return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SettledReply[]) : [];
  } catch {
    // A corrupt or missing outbox must never stop the plugin from starting;
    // the cost is at worst one unrecoverable reply, the alternative is no chat.
    return [];
  }
}

export function createReplyOutbox(path: string, onError?: (err: unknown) => void): ReplyOutbox {
  let items = load(path);

  const save = () => {
    try {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(items), { mode: 0o600 });
      renameSync(tmp, path);
    } catch (err) {
      onError?.(err);
    }
  };

  return {
    add(reply) {
      const settled: SettledReply = {
        ...reply,
        id: reply.id ?? randomUUID(),
        createdAt: reply.createdAt ?? Date.now(),
      };
      items = [...items, settled].slice(-MAX_PENDING_REPLIES);
      save();
      return settled;
    },
    list() {
      return [...items];
    },
    ack(ids) {
      if (ids.length === 0) return;
      const wanted = new Set(ids);
      items = items.filter((item) => !wanted.has(item.id));
      save();
    },
  };
}
