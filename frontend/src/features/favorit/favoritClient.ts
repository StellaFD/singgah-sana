import type { ApiResponse } from '@/types/api';

export interface FavoritItem {
  kos_id: string;
  ditambahkan_pada: string;
}

/**
 * STUB SEMENTARA: Client Favorit (Boundary Integrasi P2/P3)
 * PERHATIAN: Endpoint API favorit backend belum tersedia dan belum diimplementasikan.
 * Fungsi ini mengembalikan status `unavailable` secara jujur dan TIDAK menyimpan data secara nyata.
 */
export async function toggleFavoritApi(
  _kosId: string,
  _signal?: AbortSignal
): Promise<ApiResponse<{ bookmarked: boolean }>> {
  return {
    success: false,
    unavailable: true,
    message: 'Layanan simpan favorit saat ini belum tersedia. Pilihan Anda belum tersimpan.',
  };
}
