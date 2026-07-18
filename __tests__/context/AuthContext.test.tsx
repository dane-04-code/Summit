import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor, cleanup } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const mockUnsubscribe = jest.fn();

jest.mock('@/lib/supabase', () => ({
  SUPABASE_CONFIGURED: true,
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      // Use mockImplementation so mockUnsubscribe is captured at call time, not factory time
      onAuthStateChange: jest.fn().mockImplementation(() => ({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      })),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

function TestConsumer() {
  const { session, loading } = useAuth();
  if (loading) return <Text testID="loading">loading</Text>;
  return <Text testID="session">{session ? 'signed-in' : 'signed-out'}</Text>;
}

describe('AuthProvider', () => {
  it('resolves to signed-out when no session', async () => {
    await render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => screen.getByTestId('session'));
    expect(screen.getByTestId('session').props.children).toBe('signed-out');
  });

  it('calls unsubscribe on unmount', async () => {
    await render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => screen.getByTestId('session'));
    await cleanup();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
