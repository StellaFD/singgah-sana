import { z } from 'zod';
import type { Kos, KosInput } from './types';

const angkaBulat = (label: string, min: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi`)
    .regex(/^\d+$/, `${label} harus berupa angka bulat`)
    .refine((value) => Number(value) >= min, `${label} minimal ${min.toLocaleString('id-ID')}`);

const koordinat = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi. Pilih titik pada peta.`)
    .refine((value) => !Number.isNaN(Number(value)), `${label} harus berupa angka`)
    .refine((value) => Number(value) >= min && Number(value) <= max, `${label} harus di antara ${min} dan ${max}`);

export const kosFormSchema = z
  .object({
    // Langkah 1 · Informasi
    nama: z
      .string()
      .trim()
      .min(3, 'Nama kos minimal 3 karakter')
      .max(120, 'Nama kos maksimal 120 karakter'),
    tipe: z.enum(['putra', 'putri', 'campur'], { error: 'Pilih jenis kos' }),
    area_kampus: z
      .string()
      .trim()
      .max(120, 'Area kampus maksimal 120 karakter')
      .optional()
      .default(''),
    deskripsi: z
      .string()
      .trim()
      .min(20, 'Deskripsi minimal 20 karakter')
      .max(5000, 'Deskripsi maksimal 5.000 karakter'),

    // Langkah 2 · Lokasi
    alamat: z
      .string()
      .trim()
      .min(10, 'Alamat lengkap minimal 10 karakter')
      .max(500, 'Alamat maksimal 500 karakter'),
    latitude: koordinat('Latitude', -90, 90),
    longitude: koordinat('Longitude', -180, 180),

    // Langkah 3 · Foto (hanya ID aset yang valid dari unggahan nyata, URL bebas tidak dipakai)
    foto_ids: z
      .array(z.string().min(1))
      .min(1, 'Pilih minimal satu foto kos')
      .max(5, 'Maksimal 5 foto'),
    foto_urls: z.array(z.string()).optional().default([]),

    // Langkah 4 · Fasilitas & aturan
    fasilitas: z
      .array(z.string().trim().min(1).max(50))
      .min(1, 'Pilih minimal satu fasilitas')
      .max(20, 'Maksimal 20 fasilitas'),
    peraturan: z
      .array(z.string().trim().min(1).max(100))
      .max(15, 'Maksimal 15 aturan')
      .default([]),

    // Langkah 5 · Kamar & harga (harga kontrak minimal 1)
    harga_per_bulan: angkaBulat('Harga per bulan', 1),
    luas_kamar: z.string().trim().max(30, 'Ukuran kamar maksimal 30 karakter').optional().default(''),
    jumlah_kamar_total: angkaBulat('Jumlah kamar total', 1),
    jumlah_kamar_tersedia: angkaBulat('Kamar tersedia', 0),
  })
  .refine(
    (data) => Number(data.jumlah_kamar_tersedia) <= Number(data.jumlah_kamar_total),
    {
      path: ['jumlah_kamar_tersedia'],
      message: 'Kamar tersedia tidak boleh melebihi jumlah kamar total',
    }
  );

export type KosFormValues = z.input<typeof kosFormSchema>;
export type KosFormOutput = z.output<typeof kosFormSchema>;

/** Field yang divalidasi pada tiap langkah sebelum boleh lanjut. */
export const STEP_FIELDS: (keyof KosFormValues)[][] = [
  ['nama', 'tipe', 'area_kampus', 'deskripsi'],
  ['alamat', 'latitude', 'longitude'],
  ['foto_ids'],
  ['fasilitas', 'peraturan'],
  ['harga_per_bulan', 'luas_kamar', 'jumlah_kamar_total', 'jumlah_kamar_tersedia'],
  [],
];

export const EMPTY_KOS_FORM: KosFormValues = {
  nama: '',
  tipe: '' as unknown as KosFormValues['tipe'],
  area_kampus: '',
  deskripsi: '',
  alamat: '',
  latitude: '',
  longitude: '',
  foto_ids: [],
  foto_urls: [],
  fasilitas: [],
  peraturan: [],
  harga_per_bulan: '',
  luas_kamar: '',
  jumlah_kamar_total: '',
  jumlah_kamar_tersedia: '',
};

/** Nilai form (string) -> data API (number). Dipanggil setelah validasi submit lolos. */
export function toKosInput(values: KosFormValues): KosInput {
  return {
    nama: values.nama.trim(),
    tipe: values.tipe,
    area_kampus: (values.area_kampus || '').trim(),
    deskripsi: values.deskripsi.trim(),
    alamat: values.alamat.trim(),
    koordinat: {
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    },
    fasilitas: values.fasilitas,
    peraturan: values.peraturan || [],
    harga_per_bulan: Number(values.harga_per_bulan),
    luas_kamar: (values.luas_kamar || '').trim(),
    jumlah_kamar_total: Number(values.jumlah_kamar_total),
    jumlah_kamar_tersedia: Number(values.jumlah_kamar_tersedia),
    foto_ids: values.foto_ids || [],
  };
}

/** Menyiapkan input parsial untuk simpan draf (tanpa memaksakan nilai 0 palsu atau string kosong). */
export function toPartialDraftPayload(
  values: Partial<KosFormValues>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (typeof values.nama === 'string' && values.nama.trim() && values.nama.trim() !== 'Draf kos (belum diberi nama)') {
    payload.nama = values.nama.trim();
  }
  if (typeof values.deskripsi === 'string' && values.deskripsi.trim()) {
    payload.deskripsi = values.deskripsi.trim();
  }
  if (typeof values.alamat === 'string' && values.alamat.trim()) {
    payload.alamat = values.alamat.trim();
  }
  if (typeof values.area_kampus === 'string' && values.area_kampus.trim()) {
    payload.area_kampus = values.area_kampus.trim();
  }
  if (
    typeof values.latitude === 'string' &&
    values.latitude.trim() !== '' &&
    typeof values.longitude === 'string' &&
    values.longitude.trim() !== '' &&
    !Number.isNaN(Number(values.latitude)) &&
    !Number.isNaN(Number(values.longitude))
  ) {
    payload.koordinat = {
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    };
  }
  if (
    typeof values.harga_per_bulan === 'string' &&
    values.harga_per_bulan.trim() !== '' &&
    !Number.isNaN(Number(values.harga_per_bulan))
  ) {
    const harga = Number(values.harga_per_bulan);
    if (harga >= 1) payload.harga_per_bulan = harga;
  }
  if (values.tipe && ['putra', 'putri', 'campur'].includes(values.tipe)) {
    payload.tipe = values.tipe;
  }
  if (Array.isArray(values.fasilitas) && values.fasilitas.length > 0) {
    payload.fasilitas = values.fasilitas;
  }
  if (Array.isArray(values.peraturan) && values.peraturan.length > 0) {
    payload.peraturan = values.peraturan;
  }
  if (typeof values.luas_kamar === 'string' && values.luas_kamar.trim()) {
    payload.luas_kamar = values.luas_kamar.trim();
  }
  if (
    typeof values.jumlah_kamar_total === 'string' &&
    values.jumlah_kamar_total.trim() !== '' &&
    !Number.isNaN(Number(values.jumlah_kamar_total))
  ) {
    const total = Number(values.jumlah_kamar_total);
    if (total >= 1) payload.jumlah_kamar_total = total;
  }
  if (
    typeof values.jumlah_kamar_tersedia === 'string' &&
    values.jumlah_kamar_tersedia.trim() !== '' &&
    !Number.isNaN(Number(values.jumlah_kamar_tersedia))
  ) {
    const tersedia = Number(values.jumlah_kamar_tersedia);
    if (tersedia >= 0) payload.jumlah_kamar_tersedia = tersedia;
  }
  if (Array.isArray(values.foto_ids) && values.foto_ids.length > 0) {
    payload.foto_ids = values.foto_ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()));
  }

  return payload;
}

/** Data kos dari backend -> nilai awal form edit. */
export function fromKos(kos: Kos): KosFormValues {
  const content = kos.raw?.draft || kos.raw?.data_publik || {};
  const fotoIds = (kos.foto_items || [])
    .map((item) => item.asset_id)
    .filter((id): id is string => Boolean(id));

  const rawNama = content.nama;
  const formNama =
    typeof rawNama === 'string' && rawNama.trim() && rawNama !== 'Draf kos (belum diberi nama)'
      ? rawNama.trim()
      : '';

  const rawTipe = content.tipe;
  const formTipe =
    rawTipe && ['putra', 'putri', 'campur'].includes(rawTipe)
      ? (rawTipe as KosFormValues['tipe'])
      : ('' as unknown as KosFormValues['tipe']);

  const lat = content.koordinat?.latitude;
  const lng = content.koordinat?.longitude;
  const hasCoordinates =
    typeof lat === 'number' && !Number.isNaN(lat) &&
    typeof lng === 'number' && !Number.isNaN(lng);

  const rawHarga = content.harga_per_bulan;
  const formHarga =
    typeof rawHarga === 'number' && rawHarga >= 1 ? String(rawHarga) : '';

  const rawTotal = content.jumlah_kamar_total;
  const formTotal =
    typeof rawTotal === 'number' && rawTotal >= 1 ? String(rawTotal) : '';

  const rawTersedia = kos.jumlah_kamar_tersedia;
  const formTersedia =
    typeof rawTersedia === 'number' && rawTersedia >= 0 ? String(rawTersedia) : '';

  return {
    nama: formNama,
    tipe: formTipe,
    area_kampus: content.area_kampus || '',
    deskripsi: content.deskripsi || '',
    alamat: content.alamat || '',
    latitude: hasCoordinates ? String(lat) : '',
    longitude: hasCoordinates ? String(lng) : '',
    foto_ids: fotoIds,
    foto_urls: kos.foto || [],
    fasilitas: Array.isArray(content.fasilitas) ? content.fasilitas : [],
    peraturan: Array.isArray(content.peraturan) ? content.peraturan : [],
    harga_per_bulan: formHarga,
    luas_kamar: content.luas_kamar ? String(content.luas_kamar) : '',
    jumlah_kamar_total: formTotal,
    jumlah_kamar_tersedia: formTersedia,
  };
}

/** Menyiapkan snapshot form untuk simpan draf ke server yang mendukung pengosongan (clear) field opsional/array. */
export function toDraftSnapshotPayload(
  values: Partial<KosFormValues>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (typeof values.nama === 'string') {
    const trimmed = values.nama.trim();
    payload.nama = trimmed && trimmed !== 'Draf kos (belum diberi nama)' ? trimmed : null;
  }

  if (typeof values.deskripsi === 'string') {
    const trimmed = values.deskripsi.trim();
    payload.deskripsi = trimmed ? trimmed : null;
  }

  if (typeof values.alamat === 'string') {
    const trimmed = values.alamat.trim();
    payload.alamat = trimmed ? trimmed : null;
  }

  if (typeof values.area_kampus === 'string') {
    const trimmed = values.area_kampus.trim();
    payload.area_kampus = trimmed ? trimmed : null;
  }

  if (
    typeof values.latitude === 'string' &&
    values.latitude.trim() !== '' &&
    typeof values.longitude === 'string' &&
    values.longitude.trim() !== '' &&
    !Number.isNaN(Number(values.latitude)) &&
    !Number.isNaN(Number(values.longitude))
  ) {
    payload.koordinat = {
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
    };
  } else if (values.latitude !== undefined || values.longitude !== undefined) {
    payload.koordinat = null;
  }

  if (typeof values.harga_per_bulan === 'string') {
    const trimmed = values.harga_per_bulan.trim();
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
      const harga = Number(trimmed);
      payload.harga_per_bulan = harga >= 1 ? harga : null;
    } else {
      payload.harga_per_bulan = null;
    }
  }

  if (values.tipe !== undefined) {
    payload.tipe = values.tipe && ['putra', 'putri', 'campur'].includes(values.tipe) ? values.tipe : null;
  }

  if (values.fasilitas !== undefined) {
    payload.fasilitas = Array.isArray(values.fasilitas) ? values.fasilitas : [];
  }

  if (values.peraturan !== undefined) {
    payload.peraturan = Array.isArray(values.peraturan) ? values.peraturan : [];
  }

  if (typeof values.luas_kamar === 'string') {
    const trimmed = values.luas_kamar.trim();
    payload.luas_kamar = trimmed ? trimmed : null;
  }

  if (typeof values.jumlah_kamar_total === 'string') {
    const trimmed = values.jumlah_kamar_total.trim();
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
      const total = Number(trimmed);
      payload.jumlah_kamar_total = total >= 1 ? total : null;
    } else {
      payload.jumlah_kamar_total = null;
    }
  }

  if (typeof values.jumlah_kamar_tersedia === 'string') {
    const trimmed = values.jumlah_kamar_tersedia.trim();
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
      const tersedia = Number(trimmed);
      payload.jumlah_kamar_tersedia = tersedia >= 0 ? tersedia : null;
    } else {
      payload.jumlah_kamar_tersedia = null;
    }
  }

  if (values.foto_ids !== undefined) {
    payload.foto_ids = Array.isArray(values.foto_ids)
      ? values.foto_ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
      : [];
  }

  return payload;
}

/** Skema form ketersediaan (halaman "Ketersediaan kamar"). */
export function ketersediaanSchema(total: number | null) {
  return z.object({
    jumlah_kamar_tersedia: z
      .string()
      .trim()
      .min(1, 'Kamar tersedia wajib diisi')
      .regex(/^\d+$/, 'Kamar tersedia harus berupa angka bulat')
      .refine(
        (value) => (total !== null ? Number(value) <= total : true),
        total !== null ? `Kamar tersedia tidak boleh melebihi ${total} kamar` : 'Jumlah kamar tidak valid'
      ),
  });
}
