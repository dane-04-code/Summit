import React, { createContext, useContext, useEffect, useMemo } from 'react';

import { POSTHOG_HOST, POSTHOG_KEY } from '@/config';

export type AnalyticsEvent =
  | 'app_opened'
  | 'auth_signed_in'
  | 'auth_failed'
  | 'pair_started'
  | 'pair_succeeded'
  | 'pair_failed'
  | 'chat_stream_started'
  | 'chat_stream_completed'
  | 'chat_stream_failed'
  | 'relay_disconnected'
  | 'relay_reconnected'
  | 'cron_opened'
  | 'cron_load_succeeded'
  | 'cron_load_failed'
  | 'agent_removed';

type AnalyticsProps = Partial<{
  app_version: string;
  duration_ms: number;
  error_kind: string;
  framework: 'hermes' | 'openclaw';
  transport: 'direct' | 'relay';
}>;

type Analytics = {
  track: (event: AnalyticsEvent, props?: AnalyticsProps) => void;
};

const NOOP_ANALYTICS: Analytics = { track: () => {} };
const AnalyticsContext = createContext<Analytics>(NOOP_ANALYTICS);
const distinctId = `summit-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

function capture(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (!POSTHOG_KEY) return;
  void fetch(`${POSTHOG_HOST.replace(/\/+$/, '')}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId,
      properties: {
        ...props,
        source: 'summit_mobile',
      },
    }),
  }).catch(() => {
    // Analytics must never affect app behavior.
  });
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<Analytics>(
    () => (POSTHOG_KEY ? { track: capture } : NOOP_ANALYTICS),
    [],
  );
  // Heartbeat: one event per launch. Proves the capture pipe reaches PostHog
  // and gives a DAU floor. No-ops when unconfigured (track is NOOP then).
  useEffect(() => {
    value.track('app_opened');
  }, [value]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): Analytics {
  return useContext(AnalyticsContext);
}
