import '@testing-library/react-native/extend-expect';
import React from 'react';

jest.mock('@clerk/clerk-expo', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useUser: () => ({ isLoaded: true, user: null }),
  useAuth: () => ({ isLoaded: true, isSignedIn: false, signOut: jest.fn().mockResolvedValue(undefined) }),
  useSignIn: () => ({
    isLoaded: true,
    signIn: { create: jest.fn().mockResolvedValue({ status: 'complete', createdSessionId: 'sess_test' }) },
    setActive: jest.fn().mockResolvedValue(undefined),
  }),
  useSignUp: () => ({
    isLoaded: true,
    signUp: {
      create: jest.fn().mockResolvedValue({ status: 'complete', createdSessionId: 'sess_test' }),
      prepareEmailAddressVerification: jest.fn().mockResolvedValue(undefined),
      attemptEmailAddressVerification: jest.fn().mockResolvedValue({ status: 'complete', createdSessionId: 'sess_test' }),
    },
    setActive: jest.fn().mockResolvedValue(undefined),
  }),
  useSSO: () => ({
    startSSOFlow: jest.fn().mockResolvedValue({ createdSessionId: null, authSessionResult: null }),
  }),
}));

// Required for React 19 concurrent mode in Jest
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
