import { api } from '../../lib/api/client';
import { mapUser, type UserDto } from '../../lib/api/adapters';

export const authApi = {
  me: (signal?: AbortSignal) =>
    api.get<UserDto>('/auth/me', { signal }).then((r) => mapUser(r.data)),

  login: (body: { email: string; password: string }) =>
    api.post<UserDto>('/auth/login', body).then((r) => mapUser(r.data)),

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
    api
      .post<UserDto>('/auth/verify-email', body)
      .then((r) => mapUser(r.data)),

  resendVerification: () => api.post<null>('/auth/resend-verification'),
};
