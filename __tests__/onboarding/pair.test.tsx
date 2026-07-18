import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  router: { back: jest.fn() },
}));

jest.mock('@/agents/AgentProvider', () => ({
  useAgents: () => ({ addAgent: jest.fn() }),
}));

jest.mock('@/notifications/push', () => ({
  resolvePushToken: jest.fn().mockResolvedValue(null),
}));

// Mocks must be registered before the route module is evaluated.
// eslint-disable-next-line import/first
import PairScreen, { AGENT_PROMPT, CURL_COMMAND } from '@/app/(app)/pair';

it('shows the complete two-step pairing flow without a back route', async () => {
  await render(<PairScreen />);

  expect(screen.getByText('Ask your agent')).toBeTruthy();
  expect(screen.getByText('Enter the code')).toBeTruthy();
  expect(screen.getByText(CURL_COMMAND)).toBeTruthy();
  expect(screen.getByText('Copy prompt')).toBeTruthy();
  expect(screen.getByLabelText('6-digit pairing code')).toBeTruthy();
  expect(screen.queryByLabelText('Back')).toBeNull();
});

it('copies a precise prompt that includes the installer and expected response', () => {
  expect(AGENT_PROMPT).toContain(CURL_COMMAND);
  expect(AGENT_PROMPT).toContain('reply with only the 6-digit pairing code');
  expect(AGENT_PROMPT).toContain('send me the full error output instead');
});
