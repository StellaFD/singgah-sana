import type { ApiResponse } from '@/types/api';

export interface SendInquiryPayload {
  kos_id: string;
  pesan: string;
  kontak_pemohon?: string;
}

/**
 * STUB SEMENTARA: Client Inquiry / Tanya Pemilik (Boundary Integrasi P2)
 * PERHATIAN: Layanan backend untuk pengiriman pesan ke pemilik belum diimplementasikan.
 * Fungsi ini mengembalikan status `unavailable` secara transparan dan TIDAK mengirimkan pesan secara nyata.
 */
export async function sendInquiryApi(
  payload: SendInquiryPayload,
  _signal?: AbortSignal
): Promise<ApiResponse<{ inquiry_id?: string }>> {
  if (!payload.pesan || !payload.pesan.trim()) {
    return {
      success: false,
      isValidationError: true,
      error: 'Pesan pertanyaan tidak boleh kosong.',
    };
  }

  return {
    success: false,
    unavailable: true,
    message: 'Layanan kirim pesan ke pengelola saat ini belum tersedia. Pesan Anda belum terkirim.',
  };
}
