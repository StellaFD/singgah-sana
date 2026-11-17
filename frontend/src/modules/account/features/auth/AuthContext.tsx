"use client";
import { useState, type ReactNode } from 'react';
import { useAuth as useSharedAuth } from '@/features/auth/AuthContext';
import { authApi } from './api';
import type { User } from '../../lib/api/types';
import { mapUser } from '../../lib/api/adapters';
export function AuthProvider({children}: {children: ReactNode}) { return <>{children}</>; }
export function useAuth() {
  const shared = useSharedAuth();
  const [signOutTarget, setSignOutTarget] = useState<string | null>(null);
  const refresh = async () => { await shared.refresh(); return authApi.me(); };
  return {
    status: shared.status === 'anonymous' ? 'guest' : shared.status,
    user: shared.user ? mapUser({...shared.user, _id:shared.user.id}) : null,
    signOutTarget,
    login: async (body: {email:string; password:string}) => { const user=await authApi.login(body); await shared.refresh(); return user; },
    googleAuth: async (body: {credential:string; role?: 'pencari' | 'pemilik'}) => {
      const result = await authApi.googleAuth(body);
      if (result.type === 'success') {
        await shared.refresh();
      }
      return result;
    },
    register: async (body: Parameters<typeof authApi.register>[0]) => { const user=await authApi.register(body); await shared.refresh(); return user; },
    logout: async (to='/masuk') => { await shared.logout(); setSignOutTarget(to); },
    clear: (to='/masuk') => { setSignOutTarget(to); void shared.refresh(); },
    setUser: (_user:User) => { void shared.refresh(); },
    refresh,
  };
}
