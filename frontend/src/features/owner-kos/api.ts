import { apiRequest, ApiError } from '@/lib/owner/api/client';
import type { ApiResult } from '@/lib/owner/api/types';
import { collectPages, type PaginatedItems } from '@/lib/pagination';
import {
  toKosViewModel,
  type Kos,
  type KosOwner,
  type SubmissionDetail,
} from './types';

/**
 * Modul API ruang pemilik kanonikal.
 * Seluruh endpoint merujuk rute kanonikal /pemilik/kos, /media, dan resource pengajuan terkait.
 * Tidak ada pemanggilan POST/PUT/DELETE legacy /kos.
 */

/** GET /pemilik/kos */
export async function listKosSaya(
  signal?: AbortSignal,
  query?: { page?: number; limit?: number; status_verifikasi?: string; q?: string }
): Promise<Kos[]> {
  const fetchPage = (page: number) => apiRequest<ApiResult<KosOwner[]> & PaginatedItems<KosOwner>>('/pemilik/kos', {
    signal,
    query: { ...query, page, limit: query?.limit ?? 100 },
  });
  const items = query?.page !== undefined
    ? (await fetchPage(query.page)).data
    : await collectPages(fetchPage, signal);
  return items.map(toKosViewModel);
}

/** GET /pemilik/kos/:id */
export async function getKosSaya(id: string, signal?: AbortSignal): Promise<Kos> {
  const result = await apiRequest<ApiResult<KosOwner>>(
    `/pemilik/kos/${encodeURIComponent(id)}`,
    { signal }
  );
  return toKosViewModel(result.data);
}

/** POST /pemilik/kos (membuat draf baru di server, menerima input parsial) */
export async function createDraft(
  input: Record<string, unknown>
): Promise<Kos> {
  const result = await apiRequest<ApiResult<KosOwner>>('/pemilik/kos', {
    method: 'POST',
    body: input,
  });
  return toKosViewModel(result.data);
}

/** PATCH /pemilik/kos/:id (memperbarui draf dengan CAS expected_version) */
export async function updateDraft(
  id: string,
  expectedVersion: number,
  input: Record<string, unknown>
): Promise<Kos> {
  const result = await apiRequest<ApiResult<KosOwner>>(
    `/pemilik/kos/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: {
        expected_version: expectedVersion,
        ...input,
      },
    }
  );
  return toKosViewModel(result.data);
}

/** POST /pemilik/kos/:id/ajukan (mengajukan draf awal untuk peninjauan admin) */
export async function submitInitialKos(
  id: string,
  expectedVersion: number
): Promise<SubmissionDetail> {
  const result = await apiRequest<ApiResult<SubmissionDetail>>(
    `/pemilik/kos/${encodeURIComponent(id)}/ajukan`,
    {
      method: 'POST',
      body: { expected_version: expectedVersion },
    }
  );
  return result.data;
}

/** POST /pemilik/kos/:id/tarik (menarik pengajuan awal yang sedang pending, mengembalikan KosOwner langsung) */
export async function withdrawInitialKos(
  id: string,
  expectedVersion: number
): Promise<Kos> {
  const result = await apiRequest<ApiResult<KosOwner>>(
    `/pemilik/kos/${encodeURIComponent(id)}/tarik`,
    {
      method: 'POST',
      body: { expected_version: expectedVersion },
    }
  );
  return toKosViewModel(result.data);
}

/** PATCH /pemilik/kos/:id/ketersediaan (mengubah stok kamar mandiri dengan version_ketersediaan) */
export async function updateStock(
  id: string,
  expectedVersionKetersediaan: number,
  jumlahKamarTersedia: number
): Promise<Kos> {
  const result = await apiRequest<ApiResult<KosOwner>>(
    `/pemilik/kos/${encodeURIComponent(id)}/ketersediaan`,
    {
      method: 'PATCH',
      body: {
        expected_version: expectedVersionKetersediaan,
        jumlah_kamar_tersedia: jumlahKamarTersedia,
      },
    }
  );
  return toKosViewModel(result.data);
}

/** PATCH /pemilik/kos/:id/publikasi (arsip atau aktifkan listing) */
export async function updatePublication(
  id: string,
  expectedVersion: number,
  statusPublikasi: 'active' | 'archived'
): Promise<Kos> {
  const result = await apiRequest<ApiResult<KosOwner>>(
    `/pemilik/kos/${encodeURIComponent(id)}/publikasi`,
    {
      method: 'PATCH',
      body: {
        expected_version: expectedVersion,
        status_publikasi: statusPublikasi,
      },
    }
  );
  return toKosViewModel(result.data);
}

/** DELETE /pemilik/kos/:id (soft delete kos, syarat status_publikasi === 'archived') */
export async function softDeleteKos(
  id: string,
  expectedVersion: number
): Promise<{ deleted_at: string }> {
  const result = await apiRequest<ApiResult<{ deleted_at: string }>>(
    `/pemilik/kos/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      body: { expected_version: expectedVersion },
    }
  );
  return result.data;
}

/** GET /pemilik/kos/:id/perubahan (memuat draf perubahan aktif bila ada) */
export async function getChangeSubmission(
  id: string,
  signal?: AbortSignal
): Promise<SubmissionDetail | null> {
  try {
    const result = await apiRequest<ApiResult<SubmissionDetail>>(
      `/pemilik/kos/${encodeURIComponent(id)}/perubahan`,
      { signal }
    );
    return result.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Menghapus field stok (jumlah_kamar_tersedia) dan field non-konten
 * dari payload perubahan konten approved.
 */
export function sanitizeChangeContentPayload(
  input: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const allowedFields = [
    'nama',
    'deskripsi',
    'alamat',
    'area_kampus',
    'koordinat',
    'harga_per_bulan',
    'tipe',
    'fasilitas',
    'peraturan',
    'luas_kamar',
    'jumlah_kamar_total',
    'foto_ids',
  ];

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      sanitized[field] = input[field];
    }
  }

  return sanitized;
}

/** PUT /pemilik/kos/:id/perubahan (membuat atau menyimpan draf perubahan konten approved tanpa stok) */
export async function upsertChangeDraft(
  id: string,
  expectedVersion: number,
  input: Record<string, unknown>
): Promise<SubmissionDetail> {
  const sanitized = sanitizeChangeContentPayload(input);
  const result = await apiRequest<ApiResult<SubmissionDetail>>(
    `/pemilik/kos/${encodeURIComponent(id)}/perubahan`,
    {
      method: 'PUT',
      body: {
        expected_version: expectedVersion,
        ...sanitized,
      },
    }
  );
  return result.data;
}

/**
 * Orkestrasi simpan draf dan ajukan perubahan konten untuk listing approved.
 * Menggunakan version yang dikembalikan dari respons upsertChangeDraft (mis. version 7)
 * saat memanggil submitChangeDraft, bukan menggunakan versi lama.
 */
export async function orchestrateSaveAndSubmitChange(
  kosId: string,
  expectedDraftVersionOrBaseVersion: number,
  contentInput: Record<string, unknown>,
  deps = {
    upsert: upsertChangeDraft,
    submit: submitChangeDraft,
  }
): Promise<SubmissionDetail> {
  const sanitized = sanitizeChangeContentPayload(contentInput);
  const upserted = await deps.upsert(
    kosId,
    expectedDraftVersionOrBaseVersion,
    sanitized
  );
  return await deps.submit(kosId, upserted.version);
}

/** DELETE /pemilik/kos/:id/perubahan (membatalkan/membuang draf perubahan) */
export async function discardChangeDraft(
  id: string,
  expectedVersion: number
): Promise<void> {
  await apiRequest<ApiResult<null>>(
    `/pemilik/kos/${encodeURIComponent(id)}/perubahan`,
    {
      method: 'DELETE',
      body: { expected_version: expectedVersion },
    }
  );
}

/** POST /pemilik/kos/:id/perubahan/ajukan (mengajukan draf perubahan untuk ditinjau admin) */
export async function submitChangeDraft(
  id: string,
  expectedVersion: number
): Promise<SubmissionDetail> {
  const result = await apiRequest<ApiResult<SubmissionDetail>>(
    `/pemilik/kos/${encodeURIComponent(id)}/perubahan/ajukan`,
    {
      method: 'POST',
      body: { expected_version: expectedVersion },
    }
  );
  return result.data;
}

/** POST /pemilik/kos/:id/perubahan/tarik (menarik pengajuan perubahan yang sedang pending) */
export async function withdrawChangeDraft(
  id: string,
  expectedVersion: number
): Promise<SubmissionDetail> {
  const result = await apiRequest<ApiResult<SubmissionDetail>>(
    `/pemilik/kos/${encodeURIComponent(id)}/perubahan/tarik`,
    {
      method: 'POST',
      body: { expected_version: expectedVersion },
    }
  );
  return result.data;
}

/** POST /media (mengunggah berkas foto nyata dan mengembalikan asset_id) */
export async function uploadMedia(
  file: File,
  alt?: string
): Promise<{ asset_id: string; url: string; alt: string }> {
  const form = new FormData();
  form.append('file', file);
  if (alt && alt.trim()) {
    form.append('alt', alt.trim());
  }

  const result = await apiRequest<
    ApiResult<{ asset_id: string; url: string; alt: string }>
  >('/media', {
    method: 'POST',
    body: form,
  });
  return result.data;
}

/**
 * Adapter kompatibilitas untuk form ketersediaan lama.
 */
export async function ubahKetersediaan(
  id: string,
  jumlahKamarTersedia: number,
  expectedVersionKetersediaan?: number
): Promise<ApiResult<Kos>> {
  let version = expectedVersionKetersediaan;
  if (version === undefined) {
    const current = await getKosSaya(id);
    version = current.version_ketersediaan;
  }
  const updated = await updateStock(id, version, jumlahKamarTersedia);
  return {
    success: true,
    message: 'Ketersediaan kamar diperbarui.',
    data: updated,
  };
}

/**
 * Adapter kompatibilitas untuk penghapusan kos lama.
 */
export async function hapusKos(
  id: string,
  expectedVersion?: number
): Promise<ApiResult<null>> {
  let version = expectedVersion;
  if (version === undefined) {
    const current = await getKosSaya(id);
    version = current.version;
  }
  await softDeleteKos(id, version);
  return {
    success: true,
    message: 'Kos berhasil dihapus.',
    data: null,
  };
}
