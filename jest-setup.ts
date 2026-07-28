import '@testing-library/react-native/extend-expect';
import React from 'react';

jest.mock('react-native-auth0', () => ({
  Auth0Provider: ({ children }: { children: React.ReactNode }) => children,
  useAuth0: () => ({
    user: null,
    isLoading: false,
    authorize: jest.fn().mockResolvedValue({}),
    clearSession: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Required for React 19 concurrent mode in Jest
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
