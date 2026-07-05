import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

const mockSignIn = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => mockSignIn(...a) } },
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  signInAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

import SignInScreen from '@/app/(auth)/sign-in';

beforeEach(() => mockSignIn.mockReset());

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
