/**
 * Runtime Validator & Normalizer DTO Publik Singgah-sana
 * Menerima data masukan bertipe `unknown` (bukan `any`) untuk menjamin keamanan tipe
 * saat menangani respons dari gateway backend eksternal.
 */

import type {
  KosItem,
  KosMapMarker,
  KosKoordinat,
  KosPemilikRingkas,
  KosFotoObject,
  KosTipe,
  StatusVerifikasi,
} from '@/types/kos';

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:5000/api';

export function getBackendApiUrl(): string {
  const envUrl = process.env.API_BASE_URL || DEFAULT_BACKEND_URL;
  return envUrl.replace(/\/+$/, '');
}

export function getBackendOrigin(): string {
  try {
    return new URL(getBackendApiUrl()).origin;
  } catch {
    return 'http://127.0.0.1:5000';
  }
}

/**
 * Daftar host eksternal yang diizinkan untuk CDN foto kos
 */
export const APPROVED_EXTERNAL_HOSTS = [
  'images.unsplash.com',
  'res.cloudinary.com',
];

/**
 * Validasi ketat koordinat numerik
 * Nilai harus berupa finite number dalam batas lat [-90, 90] dan lon [-180, 180].
 * Jika koordinat tidak valid, kembalikan null (bukan 0).
 */
export function parseCoordinateValue(val: unknown, min: number, max: number): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) && val >= min && val <= max ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  }
  return null;
}

/**
 * Sanitasi URL foto publik:
 * - Memeriksa raw traversal (dot-segments & backslash) SEBELUM konstruktor new URL menormalisasinya
 * - Foto lokal `/uploads/` diresolusikan ke backend origin agar tidak menjadi 404 pada FE
 * - Mendukung Cloudinary (`res.cloudinary.com`) dan Unsplash (`images.unsplash.com`) via approved-host config
 * - Menolak skema berbahaya (javascript:, data:), kredensial dalam URL, dan host tidak dikenal
 */
export function normalizePhotoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // 1. Tolak skema berbahaya secara dini
  if (/^(javascript|vbscript|data):/i.test(raw)) return null;

  // 2. Cek RAW traversal SEBELUM new URL menormalisasi dot-segments
  let rawDecoded = raw;
  try {
    rawDecoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  if (
    rawDecoded.includes('..') ||
    rawDecoded.includes('\\') ||
    raw.includes('..') ||
    raw.includes('\\') ||
    /%2e%2e/i.test(raw) ||
    /%5c/i.test(raw)
  ) {
    return null;
  }

  try {
    const baseBackend = getBackendApiUrl();
    const backendOrigin = getBackendOrigin();

    // 3. Tangani relative path lokal /uploads/ dan /assets/
    if (raw.startsWith('/uploads/')) {
      // next.config.mjs sudah memiliki rewrite same-origin /uploads/:path* -> backend
      // Pertahankan URL same-origin agar tidak mengekspos host/port internal backend ke browser
      return raw;
    }

    if (raw.startsWith('/assets/')) {
      // Aset statis lokal frontend
      return raw;
    }

    // 4. Parsing URL absolut
    const parsed = new URL(raw, baseBackend);

    // Tolak URL yang menyematkan kredensial (username:password@)
    if (parsed.username || parsed.password) return null;

    // URL lokal backend absolut: pertahankan path same-origin (/uploads/... atau /assets/...)
    if (
      parsed.origin === backendOrigin ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    ) {
      if (/^\/uploads\//.test(parsed.pathname)) {
        return `${parsed.pathname}${parsed.search}`;
      }
      if (/^\/assets\//.test(parsed.pathname)) {
        return `${parsed.pathname}${parsed.search}`;
      }
      return null;
    }

    // Host eksternal terpercaya yang disetujui (Cloudinary & Unsplash)
    if (
      parsed.protocol === 'https:' &&
      !parsed.port &&
      APPROVED_EXTERNAL_HOSTS.includes(parsed.hostname)
    ) {
      return parsed.href;
    }
  } catch {
    // Abaikan galat parsing URL, gunakan placeholder netral di antarmuka
  }

  return null;
}

/**
 * Normalisasi foto kos: Mendukung foto berformat array string legacy dan array objek target
 */
export function normalizePhotos(rawFoto: unknown): {
  fotoList: string[];
  fotoObjects: KosFotoObject[];
} {
  const fotoList: string[] = [];
  const fotoObjects: KosFotoObject[] = [];

  if (!Array.isArray(rawFoto)) {
    return { fotoList, fotoObjects };
  }

  for (const item of rawFoto) {
    if (typeof item === 'string') {
      const cleanUrl = normalizePhotoUrl(item);
      if (cleanUrl) {
        fotoList.push(cleanUrl);
        fotoObjects.push({ url: cleanUrl });
      }
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const rawUrl = typeof obj.url === 'string' ? obj.url : null;
      const cleanUrl = normalizePhotoUrl(rawUrl);
      if (cleanUrl) {
        fotoList.push(cleanUrl);
        fotoObjects.push({
          asset_id: typeof obj.asset_id === 'string' ? obj.asset_id : undefined,
          url: cleanUrl,
          alt: typeof obj.alt === 'string' ? obj.alt : undefined,
        });
      }
    }
  }

  return { fotoList, fotoObjects };
}

/**
 * Ekstraksi informasi pemilik ringkas:
 * Mendukung objek target ringkas maupun populated `pemilik_id` legacy.
 * Whitelist DTO publik: JANGAN pernah mengirim email akun, kata sandi, atau data autentikasi.
 * Memeriksa status pemilik (jika suspended/banned/nonaktif -> return null).
 */
export function extractSafeOwner(raw: Record<string, unknown>): {
  pemilik: KosPemilikRingkas | null;
  isOwnerSuspended: boolean;
} {
  const source = (raw.pemilik && typeof raw.pemilik === 'object'
    ? raw.pemilik
    : raw.pemilik_id && typeof raw.pemilik_id === 'object'
    ? raw.pemilik_id
    : null) as Record<string, unknown> | null;

  if (!source) {
    return { pemilik: null, isOwnerSuspended: false };
  }

  // Periksa apakah akun pemilik di-suspend atau nonaktif
  const ownerStatus = typeof source.status === 'string' ? source.status.toLowerCase().trim() : '';
  const isSuspended =
    ownerStatus === 'suspended' ||
    ownerStatus === 'suspend' ||
    ownerStatus === 'banned' ||
    ownerStatus === 'nonaktif' ||
    source.is_suspended === true ||
    source.isSuspended === true;

  if (isSuspended) {
    return { pemilik: null, isOwnerSuspended: true };
  }

  return {
    pemilik: {
      nama: typeof source.nama === 'string' && source.nama.trim() ? source.nama.trim() : 'Pengelola kos',
      role: typeof source.role === 'string' ? source.role : 'Pengelola kos',
    },
    isOwnerSuspended: false,
  };
}

/**
 * Whitelist nested biaya_detail:
 * Memvalidasi dan mengekstrak field sewa_per_bulan, deposit_awal, listrik, dan air_wifi
 * tanpa pernah meng-cast seluruh objek eksternal mentah.
 */
export function normalizeBiayaDetail(raw: unknown): KosItem['biaya_detail'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const b = raw as Record<string, unknown>;

  const parseNumber = (val: unknown): number | undefined => {
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) return val;
    if (typeof val === 'string' && val.trim()) {
      const n = Number(val.trim());
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return undefined;
  };

  const parseString = (val: unknown): string | undefined => {
    if (typeof val === 'string' && val.trim()) return val.trim();
    return undefined;
  };

  const sewa_per_bulan = parseNumber(b.sewa_per_bulan);
  const deposit_awal = parseNumber(b.deposit_awal);
  const listrik = parseString(b.listrik);
  const air_wifi = parseString(b.air_wifi ?? b.air ?? b.wifi);

  if (
    sewa_per_bulan === undefined &&
    deposit_awal === undefined &&
    listrik === undefined &&
    air_wifi === undefined
  ) {
    return undefined;
  }

  return {
    ...(sewa_per_bulan !== undefined ? { sewa_per_bulan } : {}),
    ...(deposit_awal !== undefined ? { deposit_awal } : {}),
    ...(listrik !== undefined ? { listrik } : {}),
    ...(air_wifi !== undefined ? { air_wifi } : {}),
  };
}

/**
 * Normalisasi satu entitas KosItem dari data mentah `unknown`.
 * Menerapkan gate publik ketat:
 * - status_verifikasi WAJIB 'approved'
 * - status_publikasi bila ada WAJIB 'active' (atau 'published')
 * - status_moderasi bila ada WAJIB 'normal' (atau 'approved')
 * - Pemilik suspended DIBLOKIR
 * - Status listing nonaktif/arsip/suspend/draft DIBLOKIR
 * - Tidak memfabrikasi harga 0 atau tipe putra jika field wajib tidak valid
 */
export function normalizeKosItem(raw: unknown): KosItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const r = raw as Record<string, unknown>;

  // 1. GATE PEMILIK: Jika akun pemilik suspended/banned, listing diblokir dari publik
  const { pemilik, isOwnerSuspended } = extractSafeOwner(r);
  if (isOwnerSuspended) {
    return null;
  }

  // 2. GATE VISIBILITAS UMUM: Blokir status nonaktif, arsip, suspend, draft, dsb.
  const rawStatus = typeof r.status === 'string' ? r.status.toLowerCase().trim() : '';
  const isHiddenByStatus = [
    'nonaktif',
    'arsip',
    'suspend',
    'suspended',
    'draft',
    'archived',
    'inactive',
    'rejected',
    'pending',
  ].includes(rawStatus);

  if (isHiddenByStatus) {
    return null;
  }

  // 3. GATE STATUS VERIFIKASI: Wajib 'approved' untuk tayang di DTO publik
  const rawVerif = typeof r.status_verifikasi === 'string'
    ? r.status_verifikasi.toLowerCase().trim()
    : (rawStatus === 'approved' ? 'approved' : '');

  // Jika status_verifikasi tidak approved, listing belum lolos kurasi publik
  if (rawVerif !== 'approved') {
    return null;
  }
  const status_verifikasi: StatusVerifikasi = 'approved';

  // 4. GATE STATUS PUBLIKASI: Bila field ada, harus 'active' atau 'published'
  if (r.status_publikasi !== undefined && r.status_publikasi !== null) {
    const rawPub = String(r.status_publikasi).toLowerCase().trim();
    if (rawPub !== 'active' && rawPub !== 'published') {
      return null;
    }
  }

  // 5. GATE STATUS MODERASI: Bila field ada, harus 'normal' atau 'approved'
  if (r.status_moderasi !== undefined && r.status_moderasi !== null) {
    const rawMod = String(r.status_moderasi).toLowerCase().trim();
    if (rawMod !== 'normal' && rawMod !== 'approved') {
      return null;
    }
  }

  // 6. ID MongoDB string yang aman
  const idStr = r._id ? String(r._id) : (r.id ? String(r.id) : '');
  if (!idStr) return null;

  // 7. Nama kos wajib ada dan bertipe string non-kosong
  if (typeof r.nama !== 'string' || !r.nama.trim()) {
    return null;
  }
  const nama = r.nama.trim();

  // 8. FIELD WAJIB HARGA: Jangan fabrikasi harga 0 jika invalid/hilang
  let harga_per_bulan: number | null = null;
  if (typeof r.harga_per_bulan === 'number' && Number.isFinite(r.harga_per_bulan) && r.harga_per_bulan > 0) {
    harga_per_bulan = r.harga_per_bulan;
  } else if (typeof r.harga_per_bulan === 'string' && r.harga_per_bulan.trim()) {
    const parsed = Number(r.harga_per_bulan.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      harga_per_bulan = parsed;
    }
  }

  // Jika harga tidak valid atau <= 0, tolak entitas (jangan fabrikasi 0)
  if (harga_per_bulan === null) {
    return null;
  }

  // 9. FIELD WAJIB TIPE: Jangan fabrikasi 'putra' jika tipe tidak valid
  const rawTipe = typeof r.tipe === 'string' ? r.tipe.toLowerCase().trim() : '';
  if (rawTipe !== 'putra' && rawTipe !== 'putri' && rawTipe !== 'campur') {
    return null;
  }
  const tipe: KosTipe = rawTipe;

  // 10. Normalisasi koordinat: jika invalid, kembalikan null (bukan 0)
  let koordinat: KosKoordinat | null = null;
  if (r.koordinat && typeof r.koordinat === 'object' && !Array.isArray(r.koordinat)) {
    const k = r.koordinat as Record<string, unknown>;
    const rawLat = k.latitude ?? k.lat;
    const rawLng = k.longitude ?? k.lng;
    const lat = parseCoordinateValue(rawLat, -90, 90);
    const lng = parseCoordinateValue(rawLng, -180, 180);
    if (lat !== null && lng !== null) {
      koordinat = { latitude: lat, longitude: lng };
    }
  }

  // 11. Normalisasi foto
  const { fotoList, fotoObjects } = normalizePhotos(r.foto);

  // 12. Ketersediaan kamar: Unknown stok TIDAK boleh ditulis sebagai stok penuh palsu!
  let jumlah_kamar_tersedia: number | null = null;
  if (typeof r.jumlah_kamar_tersedia === 'number' && Number.isFinite(r.jumlah_kamar_tersedia)) {
    jumlah_kamar_tersedia = Math.max(0, r.jumlah_kamar_tersedia);
  } else if (typeof r.jumlah_kamar_tersedia === 'string' && r.jumlah_kamar_tersedia.trim() !== '') {
    const parsed = Number(r.jumlah_kamar_tersedia);
    if (Number.isFinite(parsed) && parsed >= 0) {
      jumlah_kamar_tersedia = parsed;
    }
  }

  // Label display ringkas untuk lokasi
  const areaKampusStr = typeof r.area_kampus === 'string' ? r.area_kampus : '';
  const alamatStr = typeof r.alamat === 'string' ? r.alamat : '';
  const display_lokasi = areaKampusStr
    ? areaKampusStr.replace(', sekitar UGM', '').replace(' sekitar UGM', '').trim()
    : (alamatStr ? alamatStr.split(',')[0].replace('Jl. ', '').trim() : 'Sekitar Kampus');

  // Fasilitas
  const fasilitas: string[] = Array.isArray(r.fasilitas)
    ? (r.fasilitas.filter((f) => typeof f === 'string') as string[])
    : [];

  const fasilitas_kamar: string[] = Array.isArray(r.fasilitas_kamar)
    ? (r.fasilitas_kamar.filter((f) => typeof f === 'string') as string[])
    : [];

  const fasilitas_bersama: string[] = Array.isArray(r.fasilitas_bersama)
    ? (r.fasilitas_bersama.filter((f) => typeof f === 'string') as string[])
    : [];

  const aturan_kos: string[] = Array.isArray(r.aturan_kos)
    ? (r.aturan_kos.filter((a) => typeof a === 'string') as string[])
    : [];

  // Version dan ketersediaan_diperbarui_pada nullable
  const ketersediaan_diperbarui_pada =
    typeof r.ketersediaan_diperbarui_pada === 'string' && r.ketersediaan_diperbarui_pada.trim()
      ? r.ketersediaan_diperbarui_pada.trim()
      : null;

  const version =
    typeof r.version === 'number' && Number.isFinite(r.version)
      ? r.version
      : typeof r.__v === 'number' && Number.isFinite(r.__v)
      ? r.__v
      : null;

  return {
    id: idStr,
    _id: idStr,
    slug: typeof r.slug === 'string' ? r.slug : idStr,
    nama,
    deskripsi: typeof r.deskripsi === 'string' ? r.deskripsi : undefined,
    alamat: typeof r.alamat === 'string' ? r.alamat : undefined,
    area_kampus: areaKampusStr || undefined,
    area_kategori: typeof r.area_kategori === 'string' ? r.area_kategori : undefined,
    display_lokasi,
    koordinat,
    jarak_kampus: typeof r.jarak_kampus === 'string' ? r.jarak_kampus : undefined,
    foto: fotoList,
    foto_detail: fotoObjects,
    foto_keterangan: Array.isArray(r.foto_keterangan) ? (r.foto_keterangan.filter((k) => typeof k === 'string') as string[]) : undefined,
    harga_per_bulan,
    tipe,
    fasilitas_kamar,
    fasilitas_bersama,
    fasilitas,
    aturan_kos,
    luas_kamar: typeof r.luas_kamar === 'string' ? r.luas_kamar : undefined,
    perabot: typeof r.perabot === 'string' ? r.perabot : undefined,
    masa_sewa: typeof r.masa_sewa === 'string' ? r.masa_sewa : undefined,
    biaya_detail: normalizeBiayaDetail(r.biaya_detail),
    peraturan: Array.isArray(r.peraturan) ? (r.peraturan.filter((p) => typeof p === 'string') as string[]) : undefined,
    jumlah_kamar_total: typeof r.jumlah_kamar_total === 'number' ? r.jumlah_kamar_total : undefined,
    jumlah_kamar_tersedia,
    status_verifikasi,
    ketersediaan_diperbarui_pada,
    version,
    pemilik,
  };
}

/**
 * Normalisasi data untuk marker peta publik
 * Hanya mengembalikan listing yang lolos gate publik dan memiliki koordinat geografis yang valid.
 */
export function normalizeKosMapMarker(raw: unknown): KosMapMarker | null {
  const item = normalizeKosItem(raw);
  if (!item || !item.koordinat) return null;

  return {
    id: item.id,
    _id: item._id,
    nama: item.nama,
    harga_per_bulan: item.harga_per_bulan,
    tipe: item.tipe,
    jumlah_kamar_tersedia: item.jumlah_kamar_tersedia,
    koordinat: item.koordinat,
    display_lokasi: item.display_lokasi,
    foto: item.foto[0] || undefined,
  };
}
