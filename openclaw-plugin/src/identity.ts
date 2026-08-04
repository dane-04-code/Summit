import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isChannelLocator } from '../../protocol/pairingCode';

/**
 * The connector's saved pairing identity, ported to the plugin.
 *
 * The pairing code names our relay channel and `connectorToken` is the
 * credential that lets us reclaim it (relay/src/channel.ts refuses a connector
 * socket whose token doesn't match). Losing this file doesn't lose the pairing
 * on the phone's side, but it does strand the channel — so it is written
 * atomically and owner-only, exactly like connector/pairing.go does.
 */
export type RelayIdentity = { code: string; connectorToken: string };

const CODE_FILE = 'pairing_code';
const TOKEN_FILE = 'connector_token';

export type IdentityStore = {
  load: () => RelayIdentity | null;
  save: (identity: RelayIdentity) => void;
  clear: () => void;
};

function writeAtomic(path: string, contents: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, contents, { mode: 0o600 });
  renameSync(tmp, path);
}

function readTrimmed(path: string): string {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
}

export function createIdentityStore(dir: string): IdentityStore {
  const codePath = join(dir, CODE_FILE);
  const tokenPath = join(dir, TOKEN_FILE);

  return {
    load() {
      const code = readTrimmed(codePath);
      // A saved file that no longer looks like a code is worse than none: the
      // relay rejects the claim outright and we never get a fresh channel.
      // Falling back to no identity mints a new code instead of wedging.
      if (!isChannelLocator(code)) return null;
      const connectorToken = readTrimmed(tokenPath);
      return { code, connectorToken };
    },
    save(identity) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      writeAtomic(codePath, identity.code);
      if (identity.connectorToken) writeAtomic(tokenPath, identity.connectorToken);
    },
    clear() {
      rmSync(codePath, { force: true });
      rmSync(tokenPath, { force: true });
    },
  };
}
