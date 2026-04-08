'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type AuthUser,
  clearTokens,
  getStoredTokens,
  isTokenExpired,
  login as authLogin,
  logout as authLogout,
  parseJwtPayload,
  refreshTokens,
} from '@/lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredTokens();
    if (!stored) {
      setIsLoading(false);
      return;
    }

    if (!isTokenExpired(stored.accessToken)) {
      setUser(parseJwtPayload(stored.accessToken));
      setIsLoading(false);
      return;
    }

    void refreshTokens().then((tokens) => {
      if (tokens) {
        setUser(parseJwtPayload(tokens.accessToken));
      } else {
        clearTokens();
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const authUser = await authLogin(email, password);
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
