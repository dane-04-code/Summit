import { defineSetupPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { summitChannelPlugin } from './src/channel';

/** Loaded instead of the full entry during onboarding and status commands, so
 *  those paths never pull in the relay client. */
export default defineSetupPluginEntry(summitChannelPlugin);
