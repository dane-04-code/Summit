import type { User } from '@supabase/supabase-js';
import { accountName, accountInitial, authProvider, providerLabel } from '@/lib/account';

const user = (over: Partial<User>): User => over as User;

describe('accountName', () => {
  it('prefers the metadata full name', () => {
    expect(accountName(user({ user_metadata: { full_name: 'Alex Rivera' } }))).toBe('Alex Rivera');
  });

  it('falls back to the metadata name, then the email local part', () => {
    expect(accountName(user({ user_metadata: { name: 'Sam' } }))).toBe('Sam');
    expect(accountName(user({ email: 'dane@rivera.dev', user_metadata: {} }))).toBe('dane');
  });

  it('returns a neutral placeholder with no user', () => {
    expect(accountName(null)).toBe('You');
  });
});

describe('accountInitial', () => {
  it('uppercases the first character', () => {
    expect(accountInitial('alex')).toBe('A');
  });

  it('handles empty input', () => {
    expect(accountInitial('')).toBe('?');
  });
});

describe('authProvider / providerLabel', () => {
  it('maps known providers', () => {
    expect(providerLabel(authProvider(user({ app_metadata: { provider: 'apple' } })))).toBe('Apple');
    expect(providerLabel(authProvider(user({ app_metadata: { provider: 'google' } })))).toBe(
      'Google',
    );
    expect(providerLabel(authProvider(user({ app_metadata: { provider: 'email' } })))).toBe('Email');
  });

  it('falls back for unknown/missing providers', () => {
    expect(providerLabel(authProvider(null))).toBe('Account');
    expect(providerLabel(authProvider(user({ app_metadata: { provider: 'github' } })))).toBe(
      'Account',
    );
  });
});
