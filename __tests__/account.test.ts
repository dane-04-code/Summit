import { accountName, accountInitial, authProvider, providerLabel } from '@/lib/account';

type FakeUser = Parameters<typeof accountName>[0];

const user = (over: NonNullable<FakeUser>): FakeUser => over;

describe('accountName', () => {
  it('prefers the full name', () => {
    expect(accountName(user({ fullName: 'Alex Rivera' }))).toBe('Alex Rivera');
  });

  it('falls back to the first name, then the email local part', () => {
    expect(accountName(user({ firstName: 'Sam' }))).toBe('Sam');
    expect(accountName(user({ primaryEmailAddress: { emailAddress: 'dane@rivera.dev' } }))).toBe(
      'dane',
    );
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
    expect(
      providerLabel(authProvider(user({ externalAccounts: [{ provider: 'oauth_apple' }] }))),
    ).toBe('Apple');
    expect(
      providerLabel(authProvider(user({ externalAccounts: [{ provider: 'oauth_google' }] }))),
    ).toBe('Google');
    expect(providerLabel(authProvider(user({ passwordEnabled: true })))).toBe('Email');
  });

  it('falls back for unknown/missing providers', () => {
    expect(providerLabel(authProvider(null))).toBe('Account');
    expect(
      providerLabel(authProvider(user({ externalAccounts: [{ provider: 'oauth_github' }] }))),
    ).toBe('Account');
  });
});
