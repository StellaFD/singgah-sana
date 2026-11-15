/**
 * Tipe Autentikasi dan Batasan Sesi Pengguna
 */

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'unavailable';

export interface AuthUser {
  id: string;
  nama: string;
  email?: string;
  nomor_telepon?: string;
  foto_profil?: string;
  email_verified?: boolean;
  password_updated_at?: string;
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
  logout: () => Promise<void>;
}
