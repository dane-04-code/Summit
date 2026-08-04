/**
 * Display helpers for the signed-in Clerk user.
 */

type ExternalAccount = { provider?: string };

type AccountUser = {
  fullName?: string | null;
  firstName?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  externalAccounts?: ExternalAccount[];
  passwordEnabled?: boolean;
};

export function accountName(user: AccountUser | null): string {
  return (
    user?.fullName ??
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ??
    'You'
  );
}

export function accountInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

export type AuthProviderKind = 'apple' | 'google' | 'email' | 'unknown';

export function authProvider(user: AccountUser | null): AuthProviderKind {
  const provider = user?.externalAccounts?.[0]?.provider;
  if (provider === 'oauth_apple') return 'apple';
  if (provider === 'oauth_google') return 'google';
  if (user?.passwordEnabled) return 'email';
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
