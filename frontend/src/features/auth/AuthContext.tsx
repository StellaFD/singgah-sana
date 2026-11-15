'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthStatus, AuthUser, AuthContextType } from '@/types/auth';
import { fetchCurrentUser } from './authClient';

const AuthContext = createContext<AuthContextType>({
  status: 'loading',
  user: null,
  isAuthenticated: false,
  isUnavailable: false,
  isLoading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const checkAuth = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetchCurrentUser(signal);
      if (signal?.aborted) return;
      setStatus(res.status);
      setUser(res.user);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') return;
      setStatus('unavailable');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkAuth(controller.signal);

    return () => {
      controller.abort();
    };
  }, [checkAuth]);

  const refresh = useCallback(async () => {
    setStatus('loading');
    await checkAuth();
  }, [checkAuth]);

  const value: AuthContextType = {
    status,
    user,
    isAuthenticated: status === 'authenticated' && user !== null,
    isUnavailable: status === 'unavailable',
    isLoading: status === 'loading',
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
