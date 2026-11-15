/**
 * Kontrak Tipe Kos-Kosan Singgah-sana (P1 Foundation)
 * Mendukung data mentah backend (legacy & target) serta DTO publik yang ternormalisasi.
 */

export interface KosFotoObject {
  asset_id?: string;
  url: string;
  alt?: string;
}

export type KosFoto = string | KosFotoObject;

export interface KosPemilikRingkas {
  nama: string;
  role?: string;
  nomor_telepon?: string;
}

export interface KosKoordinat {
  latitude: number;
  longitude: number;
}

export type KosTipe = 'putra' | 'putri' | 'campur';

export type StatusVerifikasi = 'approved' | 'pending' | 'rejected';

/**
 * DTO Kos Publik Hasil Normalisasi
 * - Aman diekspos ke klien tanpa data sensitif akun pemilik (password/email/catatan admin)
 * - Koordinat tidak valid bernilai null (bukan 0)
 * - Ketersediaan kamar unknown bernilai null (bukan stok penuh palsu)
 */
export interface KosItem {
  id: string;
  _id: string;
  slug?: string;
  nama: string;
  deskripsi?: string;
  alamat?: string;
  area_kampus?: string;
  area_kategori?: string;
  display_lokasi?: string;
  koordinat: KosKoordinat | null;
  jarak_kampus?: string;
  foto: string[];
  foto_detail?: KosFotoObject[];
  foto_keterangan?: string[];
  harga_per_bulan: number;
  tipe: KosTipe;
  fasilitas_kamar?: string[];
  fasilitas_bersama?: string[];
  fasilitas: string[];
  aturan_kos?: string[];
  luas_kamar?: string;
  perabot?: string;
  masa_sewa?: string;
  biaya_detail?: {
    sewa_per_bulan?: number;
    deposit_awal?: number;
    listrik?: string;
    air_wifi?: string;
  };
  peraturan?: string[];
  jumlah_kamar_total?: number;
  jumlah_kamar_tersedia: number | null;
  status_verifikasi: StatusVerifikasi;
  ketersediaan_diperbarui_pada: string | null;
  version: number | null;
  pemilik: KosPemilikRingkas | null;
}

/**
 * Marker Minimal untuk Peta Publik (Leaflet)
 */
export interface KosMapMarker {
  id: string;
  _id: string;
  nama: string;
  harga_per_bulan: number;
  tipe: KosTipe;
  jumlah_kamar_tersedia: number | null;
  koordinat: KosKoordinat;
  display_lokasi?: string;
  foto?: string;
}

/**
 * Filter Query Canonical dan Legacy Aliases
 */
export interface KosFilterQuery {
  q?: string;
  tipe?: string;
  harga_min?: string | number;
  harga_max?: string | number;
  fasilitas?: string[] | string;
  kamar_tersedia?: boolean | string;
  area_kampus?: string;
  sort?: string;
  page?: number | string;
  limit?: number | string;

  // Aliases lama untuk kompatibilitas antarmuka
  minPrice?: string | number;
  maxPrice?: string | number;
  availableOnly?: boolean | string;
  area?: string;
  perPage?: number | string;
  aturan?: string[] | string;
}

/**
 * Metadata Hasil Map Peta
 */
export interface KosMapMeta {
  total: number;
  limit: number;
  truncated: boolean;
  totalCount: number;
  isTruncated: boolean;
}
