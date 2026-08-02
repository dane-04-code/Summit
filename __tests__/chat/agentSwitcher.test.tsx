/**
 * The sidebar's agent switcher. One paired agent must look exactly as it did
 * before multi-agent existed (no expander, no chrome); a second agent turns the
 * identity header into the switch.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Sidebar, type AgentOption } from '@/ui/chat/Sidebar';

// The drawer reads insets; give it a provider with fixed metrics.
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const AGENTS: AgentOption[] = [
  { id: 'a1', name: 'Workshop', frameworkLabel: 'Hermes' },
  { id: 'a2', name: 'Server box', frameworkLabel: 'OpenClaw' },
];

async function renderSidebar(overrides: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const props: React.ComponentProps<typeof Sidebar> = {
    visible: true,
    groups: [],
    activeId: '',
    title: 'Workshop',
    subtitle: 'Hermes',
    agents: AGENTS,
    activeAgentId: 'a1',
    onSelectAgent: jest.fn(),
    onAddAgent: jest.fn(),
    connectionState: 'connected',
    account: { name: 'Dane', initial: 'D' },
    showCron: false,
    onClose: jest.fn(),
    onNewChat: jest.fn(),
    onSelectChat: jest.fn(),
    onRenameChat: jest.fn(),
    onDeleteChat: jest.fn(),
    onOpenSettings: jest.fn(),
    onOpenCron: jest.fn(),
    ...overrides,
  };
  // `render` resolves asynchronously in this repo's RNTL setup.
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <Sidebar {...props} />
    </SafeAreaProvider>,
  );
  return props;
}

it('shows no switcher affordance with a single paired agent', async () => {
  await renderSidebar({ agents: [AGENTS[0]] });

  expect(screen.queryByLabelText('Workshop, switch agent')).toBeNull();
  // The agent name is still there — as a plain label, not a control.
  expect(screen.getByText('Workshop')).toBeTruthy();
});

it('expands the identity header into an agent list once a second is paired', async () => {
  await renderSidebar();

  expect(screen.queryByLabelText('Server box, OpenClaw')).toBeNull();

  await fireEvent.press(screen.getByLabelText('Workshop, switch agent'));

  expect(screen.getByLabelText('Workshop, Hermes')).toBeTruthy();
  expect(screen.getByLabelText('Server box, OpenClaw')).toBeTruthy();
  expect(screen.getByLabelText('Add another agent')).toBeTruthy();
});

it('selects the tapped agent and collapses the list', async () => {
  const onSelectAgent = jest.fn();
  await renderSidebar({ onSelectAgent });

  await fireEvent.press(screen.getByLabelText('Workshop, switch agent'));
  await fireEvent.press(screen.getByLabelText('Server box, OpenClaw'));

  expect(onSelectAgent).toHaveBeenCalledWith('a2');
  expect(screen.queryByLabelText('Server box, OpenClaw')).toBeNull();
});

it('marks the active agent as selected', async () => {
  await renderSidebar({ activeAgentId: 'a2' });

  await fireEvent.press(screen.getByLabelText('Workshop, switch agent'));

  expect(screen.getByLabelText('Server box, OpenClaw').props.accessibilityState).toMatchObject({
    selected: true,
  });
  expect(screen.getByLabelText('Workshop, Hermes').props.accessibilityState).toMatchObject({
    selected: false,
  });
});

it('routes to pairing from the list', async () => {
  const onAddAgent = jest.fn();
  await renderSidebar({ onAddAgent });

  await fireEvent.press(screen.getByLabelText('Workshop, switch agent'));
  await fireEvent.press(screen.getByLabelText('Add another agent'));

  expect(onAddAgent).toHaveBeenCalled();
});
