import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { summitChannelPlugin } from './src/channel';
import { createSummitService } from './src/service';
import { setPluginRuntime } from './src/runtime';

/**
 * Summit for OpenClaw.
 *
 * `registerFull` is the runtime-only half — discovery and setup-only loads
 * never reach it, so the relay connection is never opened just because someone
 * ran `openclaw channels list`.
 */
export default defineChannelPluginEntry({
  id: 'summit',
  name: 'Summit',
  description: 'Bridge this OpenClaw Gateway to the Summit mobile app.',
  plugin: summitChannelPlugin,
  setRuntime: setPluginRuntime,
  registerFull(api) {
    setPluginRuntime(api.runtime);
    api.registerService(createSummitService());
  },
});
