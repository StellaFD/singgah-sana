import { api } from '../../lib/api/client';
import type { KosDto } from '../../lib/api/adapters';
import type { Percakapan, Pesan } from '../../lib/api/types';

export interface InquiryDto {
  _id: string;
  pesan: string;
  balasan: string;
  status: 'menunggu' | 'dibalas';
  createdAt: string;
  updatedAt: string;
  kos_id: KosDto;
  pemilik_id: { _id: string; nama: string };
  pesan_list?: Array<{ _id: string; pengirim_id: string; pengirim_role: 'pencari' | 'pemilik'; teks: string; createdAt: string }>;
}

export interface InquiryDetailDto {
  _id: string;
  status: 'menunggu' | 'dibalas';
  kos: KosDto;
  pencari: { _id: string; nama: string; nomor_telepon?: string; email?: string };
  pemilik: { _id: string; nama: string; nomor_telepon?: string; email?: string };
  riwayat_pesan: Array<{
    _id: string;
    pengirim_id: string;
    pengirim_role: 'pencari' | 'pemilik';
    teks: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

async function records(signal?: AbortSignal) {
  return (await api.get<InquiryDto[]>('/inquiry/my', { signal })).data;
}

export const inquiryApi = {
  list: async (signal?: AbortSignal): Promise<Percakapan[]> => {
    const data = await records(signal);
    return data.map((item) => {
      // Ambil pesan paling mutakhir untuk cuplikan
      let cuplikan = item.balasan || item.pesan;
      let waktu = item.updatedAt;
      if (Array.isArray(item.pesan_list) && item.pesan_list.length > 0) {
        const lastMsg = item.pesan_list[item.pesan_list.length - 1];
        cuplikan = lastMsg.teks;
        waktu = lastMsg.createdAt;
      }
      return {
        id: item._id,
        pemilik: { id: item.pemilik_id?._id, nama: item.pemilik_id?.nama || 'Pemilik Kos' },
        kos: {
          id: item.kos_id?._id,
          nama: item.kos_id?.nama,
          hargaBulanan: item.kos_id?.harga_per_bulan,
          kamarTersedia: item.kos_id?.jumlah_kamar_tersedia,
          fotoUrl: item.kos_id?.foto?.[0] || '/assets/placeholder-kos.svg',
        },
        cuplikan,
        waktu,
        belumDibaca: 0,
        status: item.status,
      };
    });
  },

  messages: async (id: string, signal?: AbortSignal): Promise<Pesan[]> => {
    try {
      const detail = (await api.get<InquiryDetailDto>(`/inquiry/${encodeURIComponent(id)}`, { signal })).data;
      return (detail.riwayat_pesan || []).map((m) => ({
        id: m._id,
        dari: m.pengirim_role === 'pencari' ? ('saya' as const) : ('lawan' as const),
        isi: m.teks,
        waktu: m.createdAt,
        status: 'terkirim' as const,
      }));
    } catch {
      // Fallback ke list jika endpoint detail belum merespons
      const all = await records(signal);
      const item = all.find((r) => r._id === id);
      if (!item) throw new Error('Pertanyaan tidak ditemukan.');
      return [
        { id: item._id + '-q', dari: 'saya' as const, isi: item.pesan, waktu: item.createdAt, status: 'terkirim' as const },
        ...(item.balasan
          ? [{ id: item._id + '-a', dari: 'lawan' as const, isi: item.balasan, waktu: item.updatedAt, status: 'terkirim' as const }]
          : []),
      ];
    }
  },

  send: async (id: string, isi: string): Promise<Pesan> => {
    const res = await api.post<{ _id: string; pengirim_id: string; pengirim_role: string; teks: string; createdAt: string }>(
      `/inquiry/${encodeURIComponent(id)}/messages`,
      { pesan: isi }
    );
    return {
      id: res.data._id,
      dari: 'saya',
      isi: res.data.teks,
      waktu: res.data.createdAt,
      status: 'terkirim',
    };
  },

  start: async (kosId: string, isi: string) => {
    const result = await api.post<InquiryDto>('/inquiry', { kos_id: kosId, pesan: isi });
    return { percakapanId: result.data._id };
  },
};
