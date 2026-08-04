import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createIdentityStore } from './identity';

const dirs: string[] = [];
const newDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'summit-identity-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('identity store', () => {
  it('round-trips a saved pairing identity', () => {
    const dir = newDir();
    createIdentityStore(dir).save({ code: 'K7M29XQP', connectorToken: 'tok' });
    expect(createIdentityStore(dir).load()).toEqual({ code: 'K7M29XQP', connectorToken: 'tok' });
  });

  it('returns null when nothing is saved', () => {
    expect(createIdentityStore(newDir()).load()).toBeNull();
  });

  it('discards a code that is no longer a valid channel locator', () => {
    // Better to mint a fresh code than to dial a claim the relay will reject,
    // which would wedge the plugin on a channel it can never reach.
    const dir = newDir();
    writeFileSync(join(dir, 'pairing_code'), 'not-a-code');
    expect(createIdentityStore(dir).load()).toBeNull();
  });

  it('still honours a legacy six-digit code so paired installs keep working', () => {
    const dir = newDir();
    writeFileSync(join(dir, 'pairing_code'), '123456');
    writeFileSync(join(dir, 'connector_token'), 'tok');
    expect(createIdentityStore(dir).load()?.code).toBe('123456');
  });

  it('clears both files', () => {
    const dir = newDir();
    const store = createIdentityStore(dir);
    store.save({ code: 'K7M29XQP', connectorToken: 'tok' });
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('writes the code without trailing whitespace', () => {
    const dir = newDir();
    createIdentityStore(dir).save({ code: 'K7M29XQP', connectorToken: 'tok' });
    expect(readFileSync(join(dir, 'pairing_code'), 'utf8')).toBe('K7M29XQP');
  });
});
