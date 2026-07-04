/**
 * The analytics layer was built but never fired a single event — nothing in
 * the app called track(). At minimum, opening the app must emit one heartbeat
 * so we can confirm the capture pipe actually reaches PostHog (and get a real
 * DAU floor). The inert-when-unconfigured path is the same `capture` guard
 * exercised in errorReporting.test.ts.
 */

import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@/config', () => ({ POSTHOG_KEY: 'test-key', POSTHOG_HOST: 'https://ph.test' }));

import { AnalyticsProvider } from '@/lib/analytics';

describe('AnalyticsProvider heartbeat', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;
  });

  it('fires a single app_opened event on mount when configured', async () => {
    render(
      <AnalyticsProvider>
        <Text>child</Text>
      </AnalyticsProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ph.test/capture/');
    const body = JSON.parse(init.body);
    expect(body.event).toBe('app_opened');
    expect(body.api_key).toBe('test-key');
  });
});
