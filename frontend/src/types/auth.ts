/**
 * Tipe Autentikasi dan Batasan Sesi Pengguna
 */

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'unavailable';

export interface AuthUser {
  id: string;
  nama: string;
  email?: string;
  role: 'pencari' | 'pemilik' | 'admin' | string;
  status?: string;
}

export interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isUnavailable: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}
