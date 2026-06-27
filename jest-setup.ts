import '@testing-library/react-native/extend-expect';

// Required for React 19 concurrent mode in Jest
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
