import * as SecureStore from 'expo-secure-store';

export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
export const CLERK_CONFIGURED = Boolean(CLERK_PUBLISHABLE_KEY);

// Clerk's token cache contract: getToken/saveToken/clearToken backed by the
// same secure storage the rest of the app already trusts for secrets.
export const clerkTokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  clearToken: (key: string) => SecureStore.deleteItemAsync(key),
};
