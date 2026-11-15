import { api, ApiError } from '../../lib/api/client';
import type { Notifikasi, PreferensiNotifikasi, Ringkasan } from '../../lib/api/types';
import { mapUser, type UserDto } from '../../lib/api/adapters';
import { favoritApi } from '../favorit/api';
import { inquiryApi } from '../inquiry/api';

const unavailable = async (): Promise<never> => {
  throw new ApiError(501, {
    code: 'UNKNOWN',
    message: 'Layanan ini belum diaktifkan. Data Anda belum diubah.',
  });
};

interface NotificationDto {
  _id: string;
  tipe: string;
  judul: string;
  isi: string;
  createdAt: string;
  dibaca: boolean;
  tautan: string;
}

export const accountApi = {
  summary: async (signal?: AbortSignal): Promise<Ringkasan> => {
    const user = (await api.get<UserDto>('/auth/me', { signal })).data;
    const [favorites, messages, notifications] = await Promise.all([
      user.role === 'pencari'
        ? favoritApi.list({}, signal)
        : Promise.resolve({ data: [], pagination: { totalData: 0 } }),
      user.role === 'pencari'
        ? inquiryApi.list(signal)
        : Promise.resolve([]),
      api.get<{ belum_dibaca: number }>('/notifikasi/jumlah', { signal }),
    ]);

    const reply = messages.find((item) => item.status === 'dibalas');

    return {
      jumlahFavorit: favorites.pagination.totalData,
      pesanBelumDibaca: messages.filter((item) => item.status === 'menunggu').length,
      notifikasiBaru: notifications.data.belum_dibaca,
      favoritTerbaru: favorites.data.slice(0, 3),
      balasanTerbaru: reply
        ? {
            percakapanId: reply.id,
            dari: reply.pemilik.nama,
            kos: reply.kos.nama,
            waktu: reply.waktu,
            cuplikan: reply.cuplikan,
          }
        : null,
    };
  },

  updateProfile: async (body: { nama: string; telepon: string }) =>
    mapUser(
      (
        await api.patch<UserDto>('/auth/profile', {
          nama: body.nama,
          nomor_telepon: body.telepon,
        })
      ).data
    ),

  uploadPhoto: (_file: File) => unavailable(),

  changePassword: async (body: { passwordSaatIni: string; passwordBaru: string }) => {
    await api.patch('/auth/password', {
      password_lama: body.passwordSaatIni,
      password_baru: body.passwordBaru,
    });
    return mapUser((await api.get<UserDto>('/auth/me')).data);
  },

  changeEmail: (_body: { emailBaru: string; password: string }): Promise<{ emailBaru: string }> =>
    unavailable(),

  deleteAccount: (_body: { password: string }) => unavailable(),

  notifications: async (
    q: { status?: 'belum-dibaca'; page?: number; limit?: number },
    signal?: AbortSignal
  ) => {
    const result = await api.get<NotificationDto[]>('/notifikasi', {
      query: { ...q, status: q.status ? 'belum_dibaca' : undefined },
      signal,
    });
    return {
      ...result,
      data: result.data.map(
        (item) =>
          ({
            id: item._id,
            jenis: item.tipe.includes('pesan') ? 'pesan' : 'kos',
            judul: item.judul,
            isi: item.isi,
            waktu: item.createdAt,
            dibaca: item.dibaca,
            tautan: item.tautan || null,
          }) as Notifikasi
      ),
    };
  },

  markRead: (id: string) =>
    api.patch<null>('/notifikasi/' + encodeURIComponent(id) + '/baca'),

  markAllRead: () => api.patch<null>('/notifikasi/baca-semua'),

  preferences: (signal?: AbortSignal) =>
    api.get<PreferensiNotifikasi>('/auth/notification-preferences', { signal }).then((r) => r.data),

  savePreferences: (body: PreferensiNotifikasi) =>
    api
      .put<PreferensiNotifikasi>('/auth/notification-preferences', body)
      .then((r) => r.data),
};
