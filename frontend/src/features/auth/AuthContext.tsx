'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthStatus, AuthUser, AuthContextType } from '@/types/auth';
import Modal from '@/components/ui/Modal';
import { fetchCurrentUser } from './authClient';
import { sessionRequest } from './sessionClient';

const AuthContext = createContext<AuthContextType>({
  status: 'loading',
  user: null,
  isAuthenticated: false,
  isUnavailable: false,
  isLoading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

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

  const logout = useCallback(async () => {
    await sessionRequest('/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    const handle = () => { void checkAuth(); };
    const handleExpired = () => {
      setUser(null);
      setStatus('anonymous');
      setSessionExpiredOpen(true);
    };
    window.addEventListener('focus', handle);
    window.addEventListener('ss:auth-changed', handle);
    window.addEventListener('ss:session-expired', handleExpired);
    return () => {
      window.removeEventListener('focus', handle);
      window.removeEventListener('ss:auth-changed', handle);
      window.removeEventListener('ss:session-expired', handleExpired);
    };
  }, [checkAuth]);

  const value: AuthContextType = {
    status,
    user,
    isAuthenticated: status === 'authenticated' && user !== null,
    isUnavailable: status === 'unavailable',
    isLoading: status === 'loading',
    refresh,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Modal
        isOpen={sessionExpiredOpen}
        onClose={() => setSessionExpiredOpen(false)}
        title="Sesi Masuk Telah Berakhir"
        description="Pemberitahuan Keamanan Sesi"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">
            Demi keamanan akun Anda, sesi masuk telah kedaluwarsa. Data formulir atau draf yang belum terkirim tetap tersimpan dengan aman di peramban ini.
          </p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Silakan masuk kembali untuk melanjutkan tanpa kehilangan draf yang sedang Anda kerjakan.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSessionExpiredOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                setSessionExpiredOpen(false);
                const current = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
                window.location.assign(`/masuk?next=${encodeURIComponent(current)}`);
              }}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90"
            >
              Masuk Kembali
            </button>
          </div>
        </div>
      </Modal>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
