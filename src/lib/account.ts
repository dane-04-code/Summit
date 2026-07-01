/**
 * Display helpers for the signed-in Supabase user. Email auth has no name, so we
 * fall back to the email's local part, then a neutral placeholder.
 */

import type { User } from '@supabase/supabase-js';

export function accountName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user?.email?.split('@')[0] ?? 'You';
}

export function accountInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

export type AuthProviderKind = 'apple' | 'google' | 'email' | 'unknown';

export function authProvider(user: User | null): AuthProviderKind {
  const p = user?.app_metadata?.provider;
  if (p === 'apple' || p === 'google' || p === 'email') return p;
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
