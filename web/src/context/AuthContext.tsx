import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '@/lib/api';
import type { CurrentUser, Role } from '@/types';

interface AuthValue {
  user: CurrentUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: CurrentUser) => void;
  can: (...roles: Role[]) => boolean;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  rollNumber?: string;
  department?: string;
  graduationYear?: number;
  inviteCode?: string;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthValue['status']>('loading');

  // On boot, trade the httpOnly refresh cookie for an access token so a page
  // reload does not sign the user out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.post<{ user: CurrentUser; accessToken: string }>('/api/auth/refresh');
        if (cancelled) return;
        tokenStore.set(data.accessToken);
        setUser(data.user);
        setStatus('authenticated');
      } catch {
        if (!cancelled) setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When a refresh finally fails mid-session, drop back to the signed-out state.
  useEffect(() => {
    tokenStore.onExpired(() => {
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ user: CurrentUser; accessToken: string }>('/api/auth/login', { email, password });
    tokenStore.set(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await api.post<{ user: CurrentUser; accessToken: string }>('/api/auth/register', input);
    tokenStore.set(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    tokenStore.set(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      updateUser: setUser,
      can: (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
    }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
