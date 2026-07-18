import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

const mockSignIn = jest.fn();
const mockReplace = jest.fn();
jest.mock('@/lib/supabase', () => ({
  SUPABASE_CONFIGURED: true,
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => mockSignIn(...a) } },
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  signInAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

// Auth and router mocks must be registered before the route module is evaluated.
// eslint-disable-next-line import/first
import SignInScreen from '@/app/(auth)/sign-in';

beforeEach(() => {
  mockSignIn.mockReset();
  mockReplace.mockReset();
});

it('offers account creation and uses native keyboard insets', async () => {
  await render(<SignInScreen />);

  expect(screen.getByText('Create one')).toBeTruthy();
  expect(screen.getByTestId('sign-in-scroll').props.automaticallyAdjustKeyboardInsets).toBe(true);

  fireEvent.press(screen.getByText('Create one'));
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-up');
});

it('submits trimmed credentials to Supabase', async () => {
  mockSignIn.mockResolvedValue({ error: null });
  await render(<SignInScreen />);

  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), ' me@site.dev ');
    fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'hunter22');
  });
  await act(async () => {
    fireEvent.press(screen.getByText('Sign in'));
  });

  expect(mockSignIn).toHaveBeenCalledWith({ email: 'me@site.dev', password: 'hunter22' });
});

it('surfaces auth errors', async () => {
  mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
  await render(<SignInScreen />);

  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'me@site.dev');
    fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'nope');
  });
  await act(async () => {
    fireEvent.press(screen.getByText('Sign in'));
  });

  expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
});
