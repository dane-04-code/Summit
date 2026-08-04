import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createReplyOutbox } from './outbox';

const dirs: string[] = [];
const outboxPath = () => {
  const dir = mkdtempSync(join(tmpdir(), 'summit-outbox-'));
  dirs.push(dir);
  return join(dir, 'reply_outbox.json');
};

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const reply = (reqId: string) => ({
  reqId,
  sessionId: 's1',
  status: 'done' as const,
  content: `answer ${reqId}`,
});

describe('reply outbox', () => {
  it('mints an id and timestamp, and survives a restart', () => {
    const path = outboxPath();
    const added = createReplyOutbox(path).add(reply('r1'));
    expect(added.id).toBeTruthy();
    expect(added.createdAt).toBeGreaterThan(0);

    const reopened = createReplyOutbox(path).list();
    expect(reopened).toHaveLength(1);
    expect(reopened[0]?.content).toBe('answer r1');
  });

  it('drops only acknowledged replies', () => {
    const path = outboxPath();
    const outbox = createReplyOutbox(path);
    const first = outbox.add(reply('r1'));
    outbox.add(reply('r2'));

    outbox.ack([first.id]);
    expect(outbox.list().map((r) => r.reqId)).toEqual(['r2']);
    // The drop is durable — a restart mid-sync must not resurrect it.
    expect(createReplyOutbox(path).list().map((r) => r.reqId)).toEqual(['r2']);
  });

  it('ignores an empty ack', () => {
    const outbox = createReplyOutbox(outboxPath());
    outbox.add(reply('r1'));
    outbox.ack([]);
    expect(outbox.list()).toHaveLength(1);
  });

  it('caps the queue so an offline phone cannot grow the file forever', () => {
    const outbox = createReplyOutbox(outboxPath());
    for (let i = 0; i < 105; i++) outbox.add(reply(`r${i}`));
    const items = outbox.list();
    expect(items).toHaveLength(100);
    // Oldest are shed first; the newest reply is always kept.
    expect(items[0]?.reqId).toBe('r5');
    expect(items.at(-1)?.reqId).toBe('r104');
  });

  it('starts empty rather than throwing on a corrupt file', () => {
    const path = outboxPath();
    writeFileSync(path, '{not json');
    const outbox = createReplyOutbox(path);
    expect(outbox.list()).toEqual([]);
    outbox.add(reply('r1'));
    expect(JSON.parse(readFileSync(path, 'utf8'))).toHaveLength(1);
  });
});
