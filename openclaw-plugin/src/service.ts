import { join } from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/channel-core';
import type { OpenClawPluginServiceContext } from 'openclaw/plugin-sdk/plugin-entry';
import { createSummitBridge } from './bridge';
import { resolveAccount } from './config';
import { createIdentityStore } from './identity';
import { createReplyOutbox } from './outbox';
import { createRelayClient, type RelayClient, type RelayLogger } from './relay-client';
import { getPluginRuntime, setBridge } from './runtime';

/**
 * The background half of the plugin: one outbound relay connection, started
 * with the Gateway and stopped with it.
 *
 * Everything that can fail at runtime lives here rather than in `channel.ts`,
 * so a misconfigured or offline relay degrades to "no pairing code yet" instead
 * of breaking channel discovery.
 */
export const SERVICE_ID = 'summit-relay';

export function createSummitService() {
  let client: RelayClient | null = null;

  return {
    id: SERVICE_ID,

    start(ctx: OpenClawPluginServiceContext) {
      const account = resolveAccount(ctx.config);
      const logger: RelayLogger = {
        info: (message) => ctx.logger.info(message),
        warn: (message) => ctx.logger.warn(message),
        error: (message) => ctx.logger.error(message),
      };

      if (!account.enabled) {
        logger.info('summit: channel disabled in config — not dialling the relay.');
        return;
      }

      const runtime = getPluginRuntime();
      if (!runtime) {
        logger.error('summit: plugin runtime unavailable — cannot bridge chat.');
        return;
      }

      const stateDir = account.stateDir ?? ctx.stateDir;
      const agentName = account.agentName ?? 'OpenClaw';

      const outbox = createReplyOutbox(join(stateDir, 'reply_outbox.json'), (err) =>
        logger.warn(`summit: reply outbox write failed: ${String(err)}`),
      );

      const relay = createRelayClient({
        relayUrl: account.relayUrl,
        agentName,
        agentVersion: runtime.version,
        identity: createIdentityStore(stateDir),
        logger,
        onFrame: (frame) => bridge.handleFrame(frame),
      });

      const bridge = createSummitBridge({
        runtime,
        // Read through to the live snapshot: the service outlives a config
        // hot-reload, and a turn should route with the current config, not the
        // one that happened to be loaded at Gateway startup.
        getConfig: () => runtime.config.current() as unknown as OpenClawConfig,
        agentName,
        outbox,
        logger,
        send: (frame) => relay.send(frame),
      });

      setBridge(bridge);
      client = relay;
      relay.start();
    },

    stop() {
      client?.stop();
      client = null;
      setBridge(null);
    },
  };
}
