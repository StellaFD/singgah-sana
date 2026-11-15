import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';

export type AdminUser = Record<string, unknown> & {
  email?: string;
  nama?: string;
  role: 'admin';
};

export type AdminSessionStatus =
  | 'checking'
  | 'redirecting'
  | 'forbidden'
  | 'error'
  | 'authenticated';

export type AdminSession = {
  admin: AdminUser | null;
  errorMessage: string;
  expireSession: () => void;
  logout: () => void;
  retry: () => void;
  status: AdminSessionStatus;
  token: undefined;
};

export type AdminSessionRouter = {
  isReady?: boolean;
  replace: (url: string) => unknown;
};

export default function useAdminSession(router: AdminSessionRouter): AdminSession {
  const auth = useAuth();
  const [error, setError] = useState('');

  const status: AdminSessionStatus =
    error || auth.isUnavailable
      ? 'error'
      : auth.isLoading
      ? 'checking'
      : !auth.isAuthenticated
      ? 'redirecting'
      : auth.user?.role !== 'admin'
      ? 'forbidden'
      : 'authenticated';

  useEffect(() => {
    if (status === 'redirecting') {
      router.replace('/masuk?next=/admin');
    }
  }, [router, status]);

  return {
    admin: auth.user?.role === 'admin' ? { ...auth.user, role: 'admin' } : null,
    token: undefined,
    status,
    errorMessage: error || 'Sesi tidak dapat diperiksa. Coba lagi.',
    expireSession: () => {
      void auth.refresh();
      router.replace('/masuk?next=/admin&sesi=berakhir');
    },
    logout: () => {
      void auth.logout().then(
        () => router.replace('/masuk'),
        () => setError('Keluar gagal. Coba lagi.')
      );
    },
    retry: () => {
      setError('');
      void auth.refresh();
    },
  };
}
