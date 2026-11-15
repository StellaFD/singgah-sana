import type { AuthStatus, AuthUser } from '@/types/auth';

export interface AuthMeResponse {
  success: boolean;
  status: AuthStatus;
  user: AuthUser | null;
  message?: string;
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthMeResponse> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });

    const data = await res.json().catch(() => null);

    if (data && typeof data === 'object') {
      const status: AuthStatus =
        data.status === 'authenticated' ||
        data.status === 'anonymous' ||
        data.status === 'unavailable'
          ? data.status
          : 'unavailable';

      return {
        success: Boolean(data.success),
        status,
        user: data.user || null,
        message: data.message,
      };
    }

    return {
      success: false,
      status: 'unavailable',
      user: null,
      message: 'Format respons autentikasi tidak valid.',
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError') throw error;
    return {
      success: false,
      status: 'unavailable',
      user: null,
      message: 'Gagal menghubungi gateway sesi akun.',
    };
  }
}
