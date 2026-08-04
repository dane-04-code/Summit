import React, { createContext, useContext } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-expo';
import type { UserResource } from '@clerk/types';

type AuthContextValue = {
  session: { user: UserResource } | null;
  user: UserResource | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded: userLoaded, user } = useUser();
  const { isLoaded: authLoaded, signOut: clerkSignOut } = useClerkAuth();
  const loading = !userLoaded || !authLoaded;

  return (
    <AuthContext.Provider
      value={{
        session: user ? { user } : null,
        user: user ?? null,
        loading,
        signOut: () => clerkSignOut().catch(() => undefined),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
