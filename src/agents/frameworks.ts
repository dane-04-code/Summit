/**
 * Framework identity helpers — the one place that knows what each framework is
 * called and what to assume it can do when a transport can't probe it (relay
 * pairing reports a framework string but no capabilities object). The UI is
 * capability-driven: features appear only when these flags say so.
 */

import type { AgentCapabilities, AgentFramework } from './types';

const LABELS: Record<AgentFramework, string> = {
  hermes: 'Hermes',
  openclaw: 'OpenClaw',
  openai: 'OpenAI-compatible',
};

export function frameworkLabel(framework: AgentFramework): string {
  return LABELS[framework];
}

/**
 * Conservative capability defaults per framework, used when a live probe isn't
 * possible. Hermes behind the connector supports the full native set (the
 * connector allow-lists jobs + runs). Everything else gets the messaging floor
 * until a native integration says otherwise — additive, never subtractive.
 */
export function defaultCapabilitiesFor(framework: AgentFramework): AgentCapabilities {
  const native = framework === 'hermes';
  return {
    framework,
    // OpenClaw pushes exec approvals over the connector's persistent WS
    // (approval_req/approval_resolve frames) — live-validated Phase 2.
    hasRunApproval: native || framework === 'openclaw',
    hasRunStop: native,
    hasStreaming: true,
    hasJobs: native,
    hasSessions: native,
  };
}

/**
 * Normalize a framework string from the wire (the relay `paired` frame).
 * Unknown values fall back to the generic floor: the connector proxies OpenAI
 * chat completions regardless, so messaging still works.
 */
export function parseFramework(raw: string): AgentFramework {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'hermes' || normalized === 'openclaw' || normalized === 'openai') {
    return normalized;
  }
  return 'openai';
}
