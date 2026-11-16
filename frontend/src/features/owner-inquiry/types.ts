export type StatusInquiry = 'menunggu' | 'dibalas';

export type ChatMessage = {
  _id: string;
  pengirim_id: string;
  pengirim_role: 'pencari' | 'pemilik';
  teks: string;
  createdAt: string;
};

/** Bentuk inquiry dari GET /api/inquiries/owner (kos_id & pencari_id sudah di-populate). */
export type OwnerInquiry = {
  _id: string;
  kos_id: { _id: string; nama: string; alamat: string };
  pencari_id: { _id: string; nama: string; nomor_telepon?: string; email?: string } | null;
  pemilik_id: string;
  pesan: string;
  balasan: string;
  pesan_list?: ChatMessage[];
  status: StatusInquiry;
  createdAt: string;
  updatedAt: string;
};

export type OwnerInquiryDetail = {
  _id: string;
  status: StatusInquiry;
  kos: { _id: string; nama: string; alamat: string; foto?: string[] };
  pencari: { _id: string; nama: string; nomor_telepon?: string; email?: string } | null;
  pemilik: { _id: string; nama: string; nomor_telepon?: string; email?: string };
  riwayat_pesan: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};
