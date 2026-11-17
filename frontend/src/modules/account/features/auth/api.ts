import { api } from '../../lib/api/client';
import { mapUser, type UserDto } from '../../lib/api/adapters';

export const authApi = {
  me: (signal?: AbortSignal) =>
    api.get<UserDto>('/auth/me', { signal }).then((r) => mapUser(r.data)),

  login: (body: { email: string; password: string }) =>
    api.post<UserDto>('/auth/login', body).then((r) => mapUser(r.data)),

  googleAuth: (body: { credential: string; role?: 'pencari' | 'pemilik'; password?: string }) =>
    api
      .post<UserDto | { email: string; nama: string; foto_profil: string }>(
        '/auth/google',
        body
      )
      .then((r: any) => {
        if (r.code === 'NEED_PASSWORD_LINK') {
          return {
            type: 'need_password_link' as const,
            data: r.data as { email: string; nama: string; foto_profil: string },
          };
        }
        if (r.data && 'role' in r.data && r.data.role) {
          return { type: 'success' as const, user: mapUser(r.data as UserDto) };
        }
        return {
          type: 'need_role' as const,
          data: r.data as { email: string; nama: string; foto_profil: string },
        };
      }),

  register: (body: {
    nama: string;
    email: string;
    telepon: string;
    password: string;
    role?: 'pencari' | 'pemilik';
  }) =>
    api
      .post<UserDto>('/auth/register', {
        ...body,
        nomor_telepon: body.telepon,
      })
      .then((r) => mapUser(r.data)),

  logout: () => api.post<null>('/auth/logout'),

  forgotPassword: (body: { email: string }) =>
    api.post<null>('/auth/forgot-password', body),

  resetPassword: (body: { token: string; password: string }) =>
    api.post<null>('/auth/reset-password', body),

  verifyEmail: (body: { token: string }) =>
    api.post<null>('/auth/verify-email', body).then(() => undefined),

  resendVerification: () => api.post<null>('/auth/resend-verification'),
};
