import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

class UnavailableRealtimeSocket {
  constructor() {
    throw new Error('Supabase realtime is not available in this runtime.');
  }
}

const RealtimeSocket =
  (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket ??
  (UnavailableRealtimeSocket as unknown as typeof WebSocket);

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  SUPABASE_URL || 'https://missing-supabase-url.supabase.co',
  SUPABASE_ANON_KEY || 'missing-supabase-anon-key',
  {
    auth: {
      // expo-secure-store has no web/SSR implementation; let supabase-js fall
      // back to its default storage on web (and skip storage during Node render).
      storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      transport: RealtimeSocket,
    },
  },
);
