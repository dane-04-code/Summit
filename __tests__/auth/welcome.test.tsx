import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import WelcomeScreen from '@/app/(auth)/welcome';

beforeEach(() => mockPush.mockClear());

it('renders the hero and all four feature cards', async () => {
  await render(<WelcomeScreen />);

  expect(screen.getByText('Summit')).toBeTruthy();
  expect(screen.getByText('Your agent, in your pocket.')).toBeTruthy();
  expect(screen.getByText('Talk to it anywhere')).toBeTruthy();
  expect(screen.getByText('Watch it work')).toBeTruthy();
  expect(screen.getByText('Stay in control')).toBeTruthy();
  expect(screen.getByText('Private by design')).toBeTruthy();
});

it('routes Get started to sign-up (signup enabled in dev/test)', async () => {
  await render(<WelcomeScreen />);
  fireEvent.press(screen.getByText('Get started'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');
});

it('routes the sign-in link to sign-in', async () => {
  await render(<WelcomeScreen />);
  fireEvent.press(screen.getByText(/Already have an account/));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-in');
});
