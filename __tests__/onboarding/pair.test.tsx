import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
}));

// Pairing behaves differently on first run vs. adding a second agent, so the
// test drives the agent list the screen reads.
let mockPairedAgents: { id: string }[] = [];
jest.mock('@/agents/AgentProvider', () => ({
  useAgents: () => ({ addAgent: jest.fn(), agents: mockPairedAgents }),
}));

jest.mock('@/notifications/push', () => ({
  resolvePushToken: jest.fn().mockResolvedValue(null),
}));

// Mocks must be registered before the route module is evaluated.
// eslint-disable-next-line import/first
import PairScreen, { AGENT_PROMPT, CURL_COMMAND } from '@/app/(app)/pair';

beforeEach(() => {
  mockPairedAgents = [];
});

it('shows the complete two-step pairing flow without a back route', async () => {
  await render(<PairScreen />);

  expect(screen.getByText('Ask your agent')).toBeTruthy();
  expect(screen.getByText('Enter the code')).toBeTruthy();
  expect(screen.getByText(CURL_COMMAND)).toBeTruthy();
  expect(screen.getByText('Copy prompt')).toBeTruthy();
  expect(screen.getByLabelText('Pairing code')).toBeTruthy();
  expect(screen.queryByLabelText('Back')).toBeNull();
});

it('is backable and retitled when an agent is already paired', async () => {
  mockPairedAgents = [{ id: 'agent-1' }];
  await render(<PairScreen />);

  expect(screen.getByText('Add an agent')).toBeTruthy();
  expect(screen.getByLabelText('Back')).toBeTruthy();
  // Same handshake either way — only the way out of the screen changes.
  expect(screen.getByLabelText('Pairing code')).toBeTruthy();
});

it('copies a precise prompt that includes the installer and expected response', () => {
  expect(AGENT_PROMPT).toContain(CURL_COMMAND);
  expect(AGENT_PROMPT).toContain('reply with only the pairing code it prints');
  expect(AGENT_PROMPT).toContain('send me the full error output instead');
});

it('accepts a code typed loosely and submits only once it is complete', async () => {
  await render(<PairScreen />);
  // Re-query after each change: the rendered nodes are replaced on re-render,
  // so a captured reference goes stale.
  const field = () => screen.getByLabelText('Pairing code');
  const pairButton = () => screen.getByRole('button', { name: 'Pair agent' });

  // Six characters is a partial code now, not a complete legacy one.
  await fireEvent.changeText(field(), '481920');
  expect(pairButton()).toBeDisabled();

  // Lowercase, a typed dash, and the characters Crockford drops as misreadable
  // (I → 1, O → 0) all land on the canonical form the relay routes by.
  await fireEvent.changeText(field(), 'k7m2-9xoi');
  expect(field().props.value).toBe('K7M2-9X01');
  expect(pairButton()).not.toBeDisabled();
});
