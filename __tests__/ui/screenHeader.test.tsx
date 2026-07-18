import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { ScreenHeader } from '@/ui/ScreenHeader';

it('renders title, subtitle, accessory, and fires onBack', async () => {
  const onBack = jest.fn();
  render(
    <ScreenHeader title="Cron Drops" subtitle="3 active" onBack={onBack} right={<Text>R</Text>} />,
  );
  await waitFor(() => expect(screen.getByText('Cron Drops')).toBeTruthy());
  expect(screen.getByText('3 active')).toBeTruthy();
  expect(screen.getByText('R')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back'));
  expect(onBack).toHaveBeenCalled();
});

it('can hide the back affordance for a root onboarding screen', async () => {
  await render(<ScreenHeader title="Pair your agent" showBack={false} />);
  expect(screen.getByText('Pair your agent')).toBeTruthy();
  expect(screen.queryByLabelText('Back')).toBeNull();
});
