import { createChannelPluginBase, createChatChannelPlugin } from 'openclaw/plugin-sdk/channel-core';
import { CHANNEL_ID, inspectAccount, resolveAccount, type SummitAccount } from './config';
import { getBridge } from './runtime';

/**
 * The Summit channel.
 *
 * Kept deliberately thin. `createChatChannelPlugin` is built for platforms with
 * many senders — allowlists, DM pairing, group policy, threading. Summit has
 * exactly one sender by construction: the relay refuses to forward an app frame
 * until that device has presented the session token minted at pair time
 * (relay/src/logic.ts), so authorization happens one layer below this file and
 * a second allowlist here would only be theatre. What we do want from the
 * builder is everything downstream of that — session grammar, outbound
 * delivery, and the approval/presentation seams Phase 2 hangs off.
 *
 * This module must stay cheap to import: discovery evaluates it without
 * activating the channel, so no sockets or clients are constructed here. The
 * live connection is reached through `runtime.ts`.
 */

/** Summit is single-account by design — one phone, one agent host, one channel. */
const DEFAULT_ACCOUNT_ID = 'default';

function setEnabled(cfg: Record<string, unknown>, enabled: boolean): Record<string, unknown> {
  const channels = { ...((cfg.channels as Record<string, unknown>) ?? {}) };
  const section = { ...((channels[CHANNEL_ID] as Record<string, unknown>) ?? {}) };
  section.enabled = enabled;
  channels[CHANNEL_ID] = section;
  return { ...cfg, channels };
}

const base = createChannelPluginBase<SummitAccount>({
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: 'Summit',
    selectionLabel: 'Summit (mobile app)',
    docsPath: 'https://github.com/SummitAI-app/Summit-OpenClaw',
    blurb: 'Talk to this agent from the Summit mobile app.',
    // Summit renders real Markdown on the phone — that is the headline
    // difference from a plain bot transport, so never degrade to plain text.
    markdownCapable: true,
  },
  capabilities: {
    chatTypes: ['direct'],
    media: false,
    reply: false,
    threads: false,
    reactions: false,
    polls: false,
  },
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    resolveAccount,
    inspectAccount,
    setAccountEnabled: ({ cfg, enabled }) =>
      setEnabled(cfg as unknown as Record<string, unknown>, enabled) as unknown as typeof cfg,
  },
  setup: {
    // Nothing to collect: there is no token to paste and no account to name.
    // Setup's only job is turning the channel on; the pairing code is issued
    // by the relay once the service dials out.
    applyAccountConfig: ({ cfg }) =>
      setEnabled(cfg as unknown as Record<string, unknown>, true) as unknown as typeof cfg,
  },
});

export const summitChannelPlugin = createChatChannelPlugin<SummitAccount>({
  // `createChannelPluginBase` widens every optional surface back to `| undefined`
  // even when it was supplied, so the builder cannot see that `capabilities` and
  // `config` are present. Re-narrowing here is the assertion the values above
  // already satisfy — an SDK typing wrinkle, not a missing field.
  base: base as typeof base & Required<Pick<typeof base, 'capabilities' | 'config'>>,

  // One conversation per Summit thread, replies go straight back to it.
  threading: { topLevelReplyToMode: 'none' },

  outbound: {
    base: { deliveryMode: 'direct' },
    attachedResults: {
      channel: CHANNEL_ID,
      sendText: (ctx) => {
        const bridge = getBridge();
        if (!bridge) throw new Error('summit: not connected to the relay yet');
        bridge.sendToConversation(ctx.to, ctx.text);
        // Summit has no platform-side message id to return — the phone's own
        // event id is minted when the turn settles, not per delivered block.
        return { messageId: '' };
      },
    },
  },
});
