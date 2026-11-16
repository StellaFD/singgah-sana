export type TipeKos = 'putra' | 'putri' | 'campur';

export type StatusVerifikasi =
  | 'draft'
  | 'pending'
  | 'revision'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type StatusPublikasi = 'active' | 'archived';

export type StatusModerasi = 'normal' | 'suspended';

export type KosPhotoItem = {
  asset_id: string | null;
  url: string;
  alt: string;
};

export type KosContent = {
  nama: string;
  deskripsi: string;
  alamat: string;
  area_kampus: string;
  koordinat: { latitude: number; longitude: number };
  harga_per_bulan: number;
  tipe: TipeKos;
  fasilitas: string[];
  peraturan: string[];
  luas_kamar: string | null;
  jumlah_kamar_total: number;
  foto: KosPhotoItem[];
};

export type SubmissionSummary = {
  _id: string;
  kos_id: string;
  jenis: 'baru' | 'perubahan';
  status: StatusVerifikasi;
  version: number;
  submitted_at: string | null;
  catatan_verifikasi: string | null;
};

export type SubmissionDetail = {
  _id: string;
  kos_id: string;
  jenis: 'baru' | 'perubahan';
  status: StatusVerifikasi;
  version: number;
  submitted_at: string | null;
  catatan_verifikasi: string | null;
  base_version: number;
  before: KosContent | null;
  after: KosContent;
  nama_kos: string;
  pemilik?: { _id: string; nama: string } | null;
  reviewed_at: string | null;
  reviewed_by?: { _id: string; nama: string } | null;
  perubahan?: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
};

/** DTO KosOwner kanonikal dari backend (GET /pemilik/kos, /pemilik/kos/:id). */
export type KosOwner = {
  _id: string;
  pemilik?: { _id: string; nama: string } | null;
  status_verifikasi: StatusVerifikasi;
  status_publikasi: StatusPublikasi;
  status_moderasi: StatusModerasi;
  version: number;
  ketersediaan: {
    jumlah_kamar_tersedia: number;
    version_ketersediaan: number;
    ketersediaan_diperbarui_pada: string | null;
  };
  data_publik: KosContent | null;
  draft: Partial<KosContent> | null;
  perubahan_tertunda: SubmissionSummary | null;
  deleted_at: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Model UI Pemilik (adapter dari KosOwner kanonikal).
 * Mempertahankan properti lama yang dirujuk UI sekaligus membawa DTO mentah dan metadata versi.
 */
export type Kos = {
  _id: string;
  nama: string;
  deskripsi: string;
  alamat: string;
  area_kampus: string;
  koordinat: { latitude: number; longitude: number } | null;
  foto: string[];
  foto_items: KosPhotoItem[];
  harga_per_bulan: number | null;
  tipe: TipeKos | null;
  fasilitas: string[];
  luas_kamar: string;
  peraturan: string[];
  jumlah_kamar_total: number | null;
  jumlah_kamar_tersedia: number;
  status_verifikasi: StatusVerifikasi;
  status_publikasi: StatusPublikasi;
  status_moderasi: StatusModerasi;
  catatan_verifikasi: string | null;
  diverifikasi_pada: string | null;
  pemilik_id: string;
  version: number;
  version_ketersediaan: number;
  perubahan_tertunda: SubmissionSummary | null;
  data_publik: KosContent | null;
  draft: Partial<KosContent> | null;
  deleted_at: string | null;
  createdAt: string;
  updatedAt: string;
  raw: KosOwner;
};

export function toKosViewModel(dto: KosOwner): Kos {
  const content = dto.data_publik || dto.draft || {};
  const isApproved = dto.status_verifikasi === 'approved';
  const rawPhotos: KosPhotoItem[] = Array.isArray(content.foto) ? content.foto : [];
  const photoUrls = rawPhotos.map((p) => p.url).filter(Boolean);

  const catatan =
    dto.perubahan_tertunda?.catatan_verifikasi ?? null;

  const rawNama = content.nama;
  const displayName =
    typeof rawNama === 'string' && rawNama.trim()
      ? rawNama.trim()
      : dto.status_verifikasi === 'draft'
      ? 'Draf kos (belum diberi nama)'
      : '';

  const rawHarga = content.harga_per_bulan;
  const harga =
    typeof rawHarga === 'number' && Number.isFinite(rawHarga) && rawHarga > 0
      ? rawHarga
      : null;

  const rawTipe = content.tipe;
  const tipe: TipeKos | null =
    rawTipe && ['putra', 'putri', 'campur'].includes(rawTipe)
      ? (rawTipe as TipeKos)
      : null;

  const rawTotal = content.jumlah_kamar_total;
  const totalKamar =
    typeof rawTotal === 'number' && Number.isFinite(rawTotal) && rawTotal > 0
      ? rawTotal
      : null;

  return {
    _id: dto._id,
    nama: displayName,
    deskripsi: content.deskripsi ?? '',
    alamat: content.alamat ?? '',
    area_kampus: content.area_kampus ?? '',
    koordinat: content.koordinat ?? null,
    foto: photoUrls,
    foto_items: rawPhotos,
    harga_per_bulan: harga,
    tipe,
    fasilitas: Array.isArray(content.fasilitas) ? content.fasilitas : [],
    luas_kamar: content.luas_kamar ? String(content.luas_kamar) : '',
    peraturan: Array.isArray(content.peraturan) ? content.peraturan : [],
    jumlah_kamar_total: totalKamar,
    jumlah_kamar_tersedia: dto.ketersediaan?.jumlah_kamar_tersedia ?? 0,
    status_verifikasi: dto.status_verifikasi,
    status_publikasi: dto.status_publikasi,
    status_moderasi: dto.status_moderasi,
    catatan_verifikasi: catatan,
    diverifikasi_pada: isApproved ? dto.updatedAt : null,
    pemilik_id: dto.pemilik?._id || '',
    version: dto.version,
    version_ketersediaan: dto.ketersediaan?.version_ketersediaan ?? 1,
    perubahan_tertunda: dto.perubahan_tertunda,
    data_publik: dto.data_publik,
    draft: dto.draft,
    deleted_at: dto.deleted_at,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    raw: dto,
  };
}

/** Data yang dikirim saat membuat/mengubah kos. Angka sudah dalam bentuk number. */
export type KosInput = {
  nama: string;
  deskripsi: string;
  alamat: string;
  area_kampus: string;
  koordinat: { latitude: number; longitude: number };
  harga_per_bulan: number;
  tipe: TipeKos;
  fasilitas: string[];
  luas_kamar: string;
  peraturan: string[];
  jumlah_kamar_total: number;
  jumlah_kamar_tersedia: number;
  foto_ids?: string[];
};
