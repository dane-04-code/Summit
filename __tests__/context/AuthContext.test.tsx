import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor, cleanup } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';

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

  it('exposes Auth0 loading state', async () => {
    await render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => screen.getByTestId('session'));
    expect(screen.getByTestId('session').props.children).toBe('signed-out');
  });
});
