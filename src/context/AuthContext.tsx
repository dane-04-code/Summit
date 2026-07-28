import React, { createContext, useContext } from 'react';
import { useAuth0 } from 'react-native-auth0';
import type { User } from 'react-native-auth0';

type AuthContextValue = {
  session: { user: User } | null;
  user: User | null;
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
  const { user, isLoading, clearSession } = useAuth0();

  return (
    <AuthContext.Provider
      value={{
        session: user ? { user } : null,
        user,
        loading: isLoading,
        signOut: () => clearSession().catch(() => undefined),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
