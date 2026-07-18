import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// The router mock must be registered before the route module is evaluated.
// eslint-disable-next-line import/first
import WelcomeScreen from '@/app/(auth)/welcome';

beforeEach(() => mockPush.mockClear());

it('renders the static operator-cockpit welcome screen', async () => {
  await render(<WelcomeScreen />);

  expect(screen.getByText('Summit')).toBeTruthy();
  expect(screen.getByText('Stay close to the work.')).toBeTruthy();
  expect(screen.getByText('Production checks passed')).toBeTruthy();
  expect(screen.getByText('Deploy the new release?')).toBeTruthy();
  expect(screen.getByText('Your agent key stays on your server')).toBeTruthy();
  expect(screen.queryByText(/OpenClaw support/)).toBeNull();
});

it('routes Connect your agent to sign-up (signup enabled in dev/test)', async () => {
  await render(<WelcomeScreen />);
  fireEvent.press(screen.getByText('Connect your agent'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');
});

it('routes Sign in to sign-in', async () => {
  await render(<WelcomeScreen />);
  fireEvent.press(screen.getByText('Sign in'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-in');
});
