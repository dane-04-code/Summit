import type { OpenClawConfig } from 'openclaw/plugin-sdk/channel-core';

/** Channel id this plugin registers under, and the key in `channels.*`. */
export const CHANNEL_ID = 'summit';

/** The hosted relay. Only overridden for local dev and the tester loops. */
export const DEFAULT_RELAY_URL = 'wss://relay.summitapp.dev';

/**
 * One resolved Summit account. Deliberately tiny: Summit has no bot token and
 * no allowlist to resolve — the pairing code plus the relay's per-channel
 * session token are the entire credential story, and both live in `stateDir`
 * rather than in OpenClaw's config file.
 */
export type SummitAccount = {
  accountId: string | null;
  enabled: boolean;
  relayUrl: string;
  agentName: string | undefined;
  stateDir: string | undefined;
};

type SummitSection = {
  enabled?: unknown;
  relayUrl?: unknown;
  agentName?: unknown;
  stateDir?: unknown;
};

function readSection(cfg: OpenClawConfig): SummitSection {
  const channels = (cfg as { channels?: Record<string, unknown> }).channels;
  const section = channels?.[CHANNEL_ID];
  return section && typeof section === 'object' ? (section as SummitSection) : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Resolve the account for a config snapshot.
 *
 * Unlike a normal chat channel there is nothing here that can fail to resolve —
 * an unconfigured Summit install is a *valid* one that simply hasn't been
 * turned on yet. `enabled` defaults to true because installing the plugin at
 * all is the opt-in; making the user then set a second flag would put a dead
 * step between `openclaw plugins install` and a pairing code, which is the one
 * thing this plugin exists to remove.
 */
export function resolveAccount(cfg: OpenClawConfig, accountId?: string | null): SummitAccount {
  const section = readSection(cfg);
  return {
    accountId: accountId ?? null,
    enabled: section.enabled === undefined ? true : section.enabled === true,
    relayUrl: readString(section.relayUrl) ?? DEFAULT_RELAY_URL,
    agentName: readString(section.agentName),
    stateDir: readString(section.stateDir),
  };
}

/**
 * Cold-path status for `openclaw status` / `channels list`. Safe to call before
 * the runtime loads, and it never materializes a secret because there isn't one.
 */
export function inspectAccount(cfg: OpenClawConfig, _accountId?: string | null) {
  const account = resolveAccount(cfg, _accountId);
  return {
    enabled: account.enabled,
    // "Configured" means the plugin can dial out, which it always can — the
    // relay URL has a working default.
    configured: true,
    tokenStatus: 'not-applicable' as const,
  };
}
