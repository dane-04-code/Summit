import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { SlashCommandMenu } from '@/ui/chat/SlashCommandMenu';
import { SLASH_COMMANDS } from '@/ui/chat/slashCommands';

const appCommands = SLASH_COMMANDS.filter((c) => c.scope === 'app');

it('renders a row per command and fires onSelect on press', async () => {
  const onSelect = jest.fn();
  render(<SlashCommandMenu commands={appCommands} onSelect={onSelect} />);

  await waitFor(() => expect(screen.getByText('/new')).toBeTruthy());
  expect(screen.getByText('/settings')).toBeTruthy();

  fireEvent.press(screen.getByText('/new'));
  expect(onSelect).toHaveBeenCalledWith(appCommands[0]);
});

it('renders nothing when there are no commands', async () => {
  render(<SlashCommandMenu commands={[]} onSelect={jest.fn()} />);
  await waitFor(() => expect(screen.queryByText('/new')).toBeNull());
});
