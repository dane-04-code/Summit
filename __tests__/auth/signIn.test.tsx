import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

const mockCreate = jest.fn();
const mockSetActive = jest.fn();
const mockStartSSOFlow = jest.fn();
const mockReplace = jest.fn();

jest.mock('@clerk/clerk-expo', () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: { create: mockCreate },
    setActive: mockSetActive,
  }),
  useSSO: () => ({ startSSOFlow: mockStartSSOFlow }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

// Auth and router mocks must be registered before the route module is evaluated.
// eslint-disable-next-line import/first
import SignInScreen from '@/app/(auth)/sign-in';

beforeEach(() => {
  mockCreate.mockReset();
  mockSetActive.mockReset();
  mockStartSSOFlow.mockReset();
  mockReplace.mockReset();
});

it('offers account creation without automatic keyboard translation', async () => {
  await render(<SignInScreen />);

  expect(screen.getByText('Create one')).toBeTruthy();
  expect(screen.getByTestId('sign-in-scroll').props.automaticallyAdjustKeyboardInsets).toBeUndefined();

  fireEvent.press(screen.getByText('Create one'));
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-up');
});

it('starts sign-in with email and password', async () => {
  mockCreate.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_test' });
  await render(<SignInScreen />);

  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
  });
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'hunter2');
  });
  await act(async () => {
    fireEvent.press(screen.getByText('Continue with email'));
  });

  expect(mockCreate).toHaveBeenCalledWith({ identifier: 'user@example.com', password: 'hunter2' });
  expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_test' });
});

it('surfaces auth errors', async () => {
  mockCreate.mockRejectedValue(new Error('Invalid login credentials'));
  await render(<SignInScreen />);

  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
  });
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'hunter2');
  });
  await act(async () => {
    fireEvent.press(screen.getByText('Continue with email'));
  });

  expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
});
