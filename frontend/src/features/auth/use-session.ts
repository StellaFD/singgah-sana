'use client';

import { useAuth } from './AuthContext';

export function useSession() {
  const auth = useAuth();
  const user = auth.user;

  return {
    ready: auth.status !== 'loading',
    session:
      user && auth.isAuthenticated
        ? {
            user: {
              ...user,
              _id: user.id,
              email: user.email || '',
              nomor_telepon: user.nomor_telepon || '',
            },
          }
        : null,
  };
}
