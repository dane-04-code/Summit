import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

const mockAuthorize = jest.fn();
const mockReplace = jest.fn();
jest.mock('react-native-auth0', () => ({
  useAuth0: () => ({ authorize: mockAuthorize, user: null, isLoading: false }),
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
  mockAuthorize.mockReset();
  mockReplace.mockReset();
});

it('offers account creation without automatic keyboard translation', async () => {
  await render(<SignInScreen />);

  expect(screen.getByText('Create one')).toBeTruthy();
  expect(screen.getByTestId('sign-in-scroll').props.automaticallyAdjustKeyboardInsets).toBeUndefined();

  fireEvent.press(screen.getByText('Create one'));
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-up');
});

it('starts Auth0 sign-in', async () => {
  mockAuthorize.mockResolvedValue({});
  await render(<SignInScreen />);

  await act(async () => {
    fireEvent.press(screen.getByText('Continue with email'));
  });

  expect(mockAuthorize).toHaveBeenCalledWith({ scope: 'openid profile email offline_access' });
});

it('surfaces auth errors', async () => {
  mockAuthorize.mockRejectedValue(new Error('Invalid login credentials'));
  await render(<SignInScreen />);

  await act(async () => {
    fireEvent.press(screen.getByText('Continue with email'));
  });

  expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
});
