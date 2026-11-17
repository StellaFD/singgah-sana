import { getAdminKos } from './adminApi';
import { shouldUseAdminV1Api } from './adminApiMode';
import { apiRequest } from './api';

export type AdminKosVerificationStatus =
  | 'draft'
  | 'pending'
  | 'revision'
  | 'approved'
  | 'rejected';
export type AdminKosPublicationStatus = 'active' | 'archived';
export type AdminKosModerationStatus = 'normal' | 'suspended';

export type AdminKosFilters = {
  page: number;
  limit: number;
  q: string;
  status_verifikasi: AdminKosVerificationStatus | '';
  status_publikasi: AdminKosPublicationStatus | '';
  status_moderasi: AdminKosModerationStatus | '';
};

export type AdminKosListItem = {
  _id: string;
  nama: string;
  lokasi: string;
  pemilik: {
    nama: string;
    email?: string;
  } | null;
  status_verifikasi: AdminKosVerificationStatus;
  status_publikasi: AdminKosPublicationStatus | null;
  status_moderasi: AdminKosModerationStatus | null;
  updatedAt: string;
  isMockDecision: boolean;
  /** ID pengajuan pending yang aktif, bila ada (hanya pada kontrak V1). */
  pengajuanId: string | null;
};

export type AdminKosListResponse = {
  success: true;
  data: AdminKosListItem[];
  pagination: {
    currentPage: number;
    limit: number;
    totalData: number;
    totalPages: number;
  };
};

type RecordValue = Record<string, unknown>;

const verificationStatuses: AdminKosVerificationStatus[] = [
  'draft',
  'pending',
  'revision',
  'approved',
  'rejected',
];
const publicationStatuses: AdminKosPublicationStatus[] = ['active', 'archived'];
const moderationStatuses: AdminKosModerationStatus[] = [
  'normal',
  'suspended',
];

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function isStatus<T extends string>(
  value: unknown,
  statuses: readonly T[]
): value is T {
  return typeof value === 'string' && statuses.includes(value as T);
}

function isPagination(value: unknown): value is AdminKosListResponse['pagination'] {
  return (
    isRecord(value) &&
    Number.isInteger(value.currentPage) &&
    Number.isInteger(value.limit) &&
    Number.isInteger(value.totalData) &&
    Number.isInteger(value.totalPages)
  );
}

function getTargetKosList(result: unknown): AdminKosListResponse {
  if (
    !isRecord(result) ||
    result.success !== true ||
    !Array.isArray(result.data) ||
    !isPagination(result.pagination)
  ) {
    throw new Error('Format daftar kos dari API tidak sesuai kontrak.');
  }

  const data = result.data.map((item): AdminKosListItem => {
    if (
      !isRecord(item) ||
      typeof item._id !== 'string' ||
      !isRecord(item.pemilik) ||
      typeof item.pemilik.nama !== 'string' ||
      !isStatus(item.status_verifikasi, verificationStatuses) ||
      !isStatus(item.status_publikasi, publicationStatuses) ||
      !isStatus(item.status_moderasi, moderationStatuses) ||
      typeof item.updatedAt !== 'string' ||
      (item.data_publik !== null && !isRecord(item.data_publik)) ||
      (item.draft !== null && !isRecord(item.draft)) ||
      !isRecord(item.pemilik_detail)
    ) {
      throw new Error('Format item daftar kos dari API tidak sesuai kontrak.');
    }

    const publicData = isRecord(item.data_publik) ? item.data_publik : null;
    const draftData = isRecord(item.draft) ? item.draft : null;
    const rawNama = draftData?.nama ?? publicData?.nama;
    // Draf yang baru dibuat boleh belum punya nama; jangan gagalkan seluruh tabel
    const nama =
      typeof rawNama === 'string' && rawNama.trim().length > 0
        ? rawNama
        : 'Draf tanpa nama';
    const pendingSubmission = isRecord(item.perubahan_tertunda)
      ? item.perubahan_tertunda
      : null;
    const pengajuanId =
      pendingSubmission &&
      pendingSubmission.status === 'pending' &&
      typeof pendingSubmission._id === 'string'
        ? pendingSubmission._id
        : null;

    const areaKampus = draftData?.area_kampus ?? publicData?.area_kampus;
    const alamat = draftData?.alamat ?? publicData?.alamat;
    const lokasi =
      (typeof areaKampus === 'string' && areaKampus) ||
      (typeof alamat === 'string' && alamat) ||
      'Lokasi tidak tersedia';
    const email = item.pemilik_detail.email;

    return {
      _id: item._id,
      nama,
      lokasi,
      pemilik: {
        nama: item.pemilik.nama,
        ...(typeof email === 'string' ? { email } : {}),
      },
      status_verifikasi: item.status_verifikasi,
      status_publikasi: item.status_publikasi,
      status_moderasi: item.status_moderasi,
      updatedAt: item.updatedAt,
      isMockDecision: false,
      pengajuanId,
    };
  });

  return {
    success: true,
    data,
    pagination: result.pagination,
  };
}

function getLegacyKosList(result: unknown): AdminKosListResponse {
  if (
    !isRecord(result) ||
    !Array.isArray(result.data) ||
    !isPagination(result.pagination)
  ) {
    throw new Error('Format daftar kos dari backend tidak sesuai.');
  }

  const data = result.data.map((item): AdminKosListItem => {
    if (
      !isRecord(item) ||
      typeof item._id !== 'string' ||
      typeof item.status_verifikasi !== 'string' ||
      !isStatus(item.status_verifikasi, verificationStatuses) ||
      typeof item.updatedAt !== 'string'
    ) {
      throw new Error('Format item daftar kos dari backend tidak sesuai.');
    }

    const owner = isRecord(item.pemilik_id) ? item.pemilik_id : null;
    return {
      _id: item._id,
      nama: typeof item.nama === 'string' ? item.nama : 'Nama tidak tersedia',
      lokasi:
        (typeof item.area_kampus === 'string' && item.area_kampus) ||
        (typeof item.alamat === 'string' && item.alamat) ||
        'Lokasi tidak tersedia',
      pemilik:
        owner && typeof owner.nama === 'string'
          ? {
              nama: owner.nama,
              ...(typeof owner.email === 'string' ? { email: owner.email } : {}),
            }
          : null,
      status_verifikasi: item.status_verifikasi,
      status_publikasi: isStatus(item.status_publikasi, publicationStatuses)
        ? item.status_publikasi
        : null,
      status_moderasi: isStatus(item.status_moderasi, moderationStatuses)
        ? item.status_moderasi
        : null,
      updatedAt: item.updatedAt,
      isMockDecision: item.isMockDecision === true,
      pengajuanId: null,
    };
  });

  return {
    success: true,
    data,
    pagination: result.pagination,
  };
}

export async function getAdminKosManagement(
  filters: AdminKosFilters,
  token: string | undefined
): Promise<AdminKosListResponse> {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
  });
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.status_verifikasi) {
    params.set('status_verifikasi', filters.status_verifikasi);
  }
  if (filters.status_publikasi) {
    params.set('status_publikasi', filters.status_publikasi);
  }
  if (filters.status_moderasi) {
    params.set('status_moderasi', filters.status_moderasi);
  }

  if (shouldUseAdminV1Api()) {
    const result: unknown = await apiRequest(
      `/admin/kos?${params.toString()}`,
      { token }
    );
    return getTargetKosList(result);
  }

  if (filters.status_publikasi || filters.status_moderasi) {
    throw new Error(
      'Filter status publikasi dan moderasi memerlukan backend dengan API kontrak.'
    );
  }

  const legacyParams = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
  });
  if (filters.q) {
    legacyParams.set('q', filters.q);
  }
  if (filters.status_verifikasi) {
    legacyParams.set('status', filters.status_verifikasi);
  }

  const result: unknown = await getAdminKos(legacyParams.toString(), token);
  return getLegacyKosList(result);
}
