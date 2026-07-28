/**
 * Display helpers for the signed-in Supabase user. Email auth has no name, so we
 * fall back to the email's local part, then a neutral placeholder.
 */

type AccountUser = {
  email?: string | null;
  name?: string | null;
  nickname?: string | null;
  sub?: string;
  user_metadata?: { full_name?: string; name?: string };
  app_metadata?: { provider?: string };
};

export function accountName(user: AccountUser | null): string {
  return user?.name ?? user?.nickname ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'You';
}

export function accountInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

export type AuthProviderKind = 'apple' | 'google' | 'email' | 'unknown';

export function authProvider(user: AccountUser | null): AuthProviderKind {
  const provider = user?.sub?.split('|')[0] ?? user?.app_metadata?.provider;
  if (provider === 'apple' || provider === 'google' || provider === 'google-oauth2' || provider === 'email') {
    return provider === 'google-oauth2' ? 'google' : provider;
  }
  return 'unknown';
}

export function providerLabel(kind: AuthProviderKind): string {
  switch (kind) {
    case 'apple':
      return 'Apple';
    case 'google':
      return 'Google';
    case 'email':
      return 'Email';
    default:
      return 'Account';
  }
}
