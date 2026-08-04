import type { PluginRuntime } from 'openclaw/plugin-sdk/channel-core';
import type { SummitBridge } from './bridge';

/**
 * The seam between the two halves of the plugin.
 *
 * The channel object is evaluated during discovery and must stay cheap to
 * import (no sockets, no clients — see `sdk-channel-plugins.md`), but its
 * outbound adapter needs the live relay connection that only exists once the
 * background service has started. A module-level holder is how the bundled
 * channels solve the same problem.
 */
let runtime: PluginRuntime | null = null;
let bridge: SummitBridge | null = null;

export function setPluginRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getPluginRuntime(): PluginRuntime | null {
  return runtime;
}

export function setBridge(next: SummitBridge | null): void {
  bridge = next;
}

export function getBridge(): SummitBridge | null {
  return bridge;
}
