import { ApiError, apiRequest } from './api';
import { shouldUseAdminV1Api } from './adminApiMode';

export type AdminKosContent = {
  nama: string;
  deskripsi: string;
  alamat: string;
  area_kampus: string;
  koordinat: {
    latitude: number;
    longitude: number;
  };
  harga_per_bulan: number;
  tipe: 'putra' | 'putri' | 'campur';
  fasilitas: string[];
  peraturan: string[];
  luas_kamar: string | null;
  jumlah_kamar_total: number;
  foto: Array<{
    asset_id: string;
    url: string;
    alt: string;
  }>;
};

export type AdminSubmissionStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'revision'
  | 'rejected'
  | 'withdrawn';

export type AdminSubmission = {
  _id: string;
  kos_id: string;
  jenis: 'baru' | 'perubahan';
  status: AdminSubmissionStatus;
  version: number;
  submitted_at: string | null;
  catatan_verifikasi: string | null;
  base_version: number;
  before: AdminKosContent | null;
  after: AdminKosContent;
  nama_kos: string;
  pemilik: {
    _id: string;
    nama: string;
  };
  reviewed_at: string | null;
  reviewed_by: {
    _id: string;
    nama: string;
  } | null;
  perubahan: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
};

export type AdminSubmissionDecision = {
  keputusan: 'approved' | 'revision' | 'rejected';
  expected_version: number;
  catatan_verifikasi?: string;
};

type AdminSubmissionList = {
  success: true;
  message: string;
  data: AdminSubmission[];
  pagination: {
    totalData: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

const MOCK_CHANGE_SUBMISSION_ID = '000000000000000000002031';
const MOCK_CHANGE_KOS_ID = '000000000000000000001031';
const MOCK_SUBMISSION_KEY = 'singgah-sana:admin:mock-submission';

const mockBefore: AdminKosContent = {
  nama: 'Kos Harmoni Pogung',
  deskripsi: 'Kos dekat kampus dengan lingkungan tenang.',
  alamat: 'Jl. Pogung Kidul No. 42B, Mlati, Sleman',
  area_kampus: 'Pogung',
  koordinat: {
    latitude: -7.7614,
    longitude: 110.3762,
  },
  harga_per_bulan: 1650000,
  tipe: 'putra',
  fasilitas: ['WiFi', 'Parkir'],
  peraturan: ['Akses 24 jam'],
  luas_kamar: '3 x 4 m',
  jumlah_kamar_total: 12,
  foto: [
    {
      asset_id: 'mock-kos-harmoni-photo-1',
      url: '/uploads/kos-a.jpg',
      alt: 'Kamar Kos Harmoni',
    },
  ],
};

const mockAfter: AdminKosContent = {
  ...mockBefore,
  deskripsi: 'Kos dekat kampus dengan akses bus dan lingkungan tenang.',
  fasilitas: ['WiFi', 'Parkir', 'Dapur bersama'],
  foto: [
    ...mockBefore.foto,
    {
      asset_id: 'mock-kos-harmoni-photo-2',
      url: '/uploads/kos-d.jpg',
      alt: 'Dapur bersama Kos Harmoni',
    },
  ],
};

const mockChangeSubmission: AdminSubmission = {
  _id: MOCK_CHANGE_SUBMISSION_ID,
  kos_id: MOCK_CHANGE_KOS_ID,
  jenis: 'perubahan',
  status: 'pending',
  version: 3,
  submitted_at: '2026-11-13T03:50:00.000Z',
  catatan_verifikasi: null,
  base_version: 2,
  before: mockBefore,
  after: mockAfter,
  nama_kos: mockAfter.nama,
  pemilik: {
    _id: '000000000000000000001008',
    nama: 'Nadia Putri',
  },
  reviewed_at: null,
  reviewed_by: null,
  perubahan: [
    {
      field: 'deskripsi',
      before: mockBefore.deskripsi,
      after: mockAfter.deskripsi,
    },
    {
      field: 'fasilitas',
      before: mockBefore.fasilitas,
      after: mockAfter.fasilitas,
    },
    {
      field: 'foto',
      before: mockBefore.foto,
      after: mockAfter.foto,
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSummary(value: unknown): value is { _id: string; nama: string } {
  return (
    isRecord(value) &&
    typeof value._id === 'string' &&
    typeof value.nama === 'string'
  );
}

function isKosContent(value: unknown): value is AdminKosContent {
  return (
    isRecord(value) &&
    typeof value.nama === 'string' &&
    typeof value.deskripsi === 'string' &&
    typeof value.alamat === 'string' &&
    typeof value.area_kampus === 'string' &&
    isRecord(value.koordinat) &&
    typeof value.koordinat.latitude === 'number' &&
    typeof value.koordinat.longitude === 'number' &&
    typeof value.harga_per_bulan === 'number' &&
    ['putra', 'putri', 'campur'].includes(String(value.tipe)) &&
    Array.isArray(value.fasilitas) &&
    value.fasilitas.every((item) => typeof item === 'string') &&
    Array.isArray(value.peraturan) &&
    value.peraturan.every((item) => typeof item === 'string') &&
    (typeof value.luas_kamar === 'string' || value.luas_kamar === null) &&
    typeof value.jumlah_kamar_total === 'number' &&
    Array.isArray(value.foto) &&
    value.foto.every(
      (photo) =>
        isRecord(photo) &&
        typeof photo.asset_id === 'string' &&
        typeof photo.url === 'string' &&
        typeof photo.alt === 'string'
    )
  );
}

export function isAdminSubmission(value: unknown): value is AdminSubmission {
  return (
    isRecord(value) &&
    typeof value._id === 'string' &&
    typeof value.kos_id === 'string' &&
    ['baru', 'perubahan'].includes(String(value.jenis)) &&
    ['draft', 'pending', 'approved', 'revision', 'rejected', 'withdrawn'].includes(
      String(value.status)
    ) &&
    Number.isInteger(value.version) &&
    isNullableString(value.submitted_at) &&
    isNullableString(value.catatan_verifikasi) &&
    Number.isInteger(value.base_version) &&
    (value.before === null || isKosContent(value.before)) &&
    isKosContent(value.after) &&
    typeof value.nama_kos === 'string' &&
    isSummary(value.pemilik) &&
    isNullableString(value.reviewed_at) &&
    (value.reviewed_by === null || isSummary(value.reviewed_by)) &&
    Array.isArray(value.perubahan) &&
    value.perubahan.every(
      (change) =>
        isRecord(change) &&
        typeof change.field === 'string' &&
        Object.hasOwn(change, 'before') &&
        Object.hasOwn(change, 'after')
    )
  );
}

export function isAdminSubmissionResponse(
  value: unknown
): value is { success: true; message: string; data: AdminSubmission } {
  return (
    isRecord(value) &&
    value.success === true &&
    typeof value.message === 'string' &&
    isAdminSubmission(value.data)
  );
}

export function isAdminSubmissionListResponse(
  value: unknown
): value is AdminSubmissionList {
  if (
    !isRecord(value) ||
    value.success !== true ||
    typeof value.message !== 'string' ||
    !Array.isArray(value.data) ||
    !isRecord(value.pagination)
  ) {
    return false;
  }

  return (
    value.data.every(isAdminSubmission) &&
    Number.isInteger(value.pagination.totalData) &&
    Number.isInteger(value.pagination.totalPages) &&
    Number.isInteger(value.pagination.currentPage) &&
    Number.isInteger(value.pagination.limit)
  );
}

function readMockSubmission(): AdminSubmission | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.sessionStorage.getItem(MOCK_SUBMISSION_KEY);
  if (!stored) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      'Data mock pengajuan lokal rusak. Tutup tab ini untuk menghapus sesi mock, lalu coba lagi.'
    );
  }

  if (!isAdminSubmission(value) || value._id !== MOCK_CHANGE_SUBMISSION_ID) {
    throw new Error('Format data mock pengajuan lokal tidak valid.');
  }

  return value;
}

function getCurrentMockSubmission(): AdminSubmission {
  return readMockSubmission() || mockChangeSubmission;
}

export function isMockAdminSubmissionId(id: string): boolean {
  return id === MOCK_CHANGE_SUBMISSION_ID;
}

export function getMockAdminSubmission(): AdminSubmission {
  return getCurrentMockSubmission();
}

export function hasPendingMockAdminSubmission(): boolean {
  return getCurrentMockSubmission().status === 'pending';
}

export async function getAdminSubmissionDetail(
  id: string,
  token: string
): Promise<AdminSubmission> {
  if (!shouldUseAdminV1Api() && isMockAdminSubmissionId(id)) {
    return getCurrentMockSubmission();
  }

  const result: unknown = await apiRequest(
    `/admin/pengajuan/${encodeURIComponent(id)}`,
    { token }
  );
  if (!isAdminSubmissionResponse(result)) {
    throw new Error('Format detail pengajuan dari API tidak sesuai kontrak.');
  }

  return result.data;
}

export async function decideAdminSubmission(
  id: string,
  decision: AdminSubmissionDecision,
  token: string
): Promise<AdminSubmission> {
  const note = decision.catatan_verifikasi?.trim();
  if (
    (decision.keputusan === 'revision' || decision.keputusan === 'rejected') &&
    !note
  ) {
    throw new Error('Catatan wajib diisi untuk revisi atau penolakan.');
  }

  if (!shouldUseAdminV1Api() && isMockAdminSubmissionId(id)) {
    const current = getCurrentMockSubmission();
    if (current.status !== 'pending' || current.version !== decision.expected_version) {
      throw new ApiError(
        'Pengajuan sudah berubah atau tidak lagi menunggu keputusan. Muat ulang detail.',
        409
      );
    }

    const updated: AdminSubmission = {
      ...current,
      status: decision.keputusan,
      catatan_verifikasi: note || null,
      version: current.version + 1,
      reviewed_at: new Date().toISOString(),
      reviewed_by: {
        _id: '000000000000000000001099',
        nama: 'Admin Lokal',
      },
    };
    window.sessionStorage.setItem(MOCK_SUBMISSION_KEY, JSON.stringify(updated));
    return updated;
  }

  const result: unknown = await apiRequest(
    `/admin/pengajuan/${encodeURIComponent(id)}/keputusan`,
    {
      token,
      method: 'PATCH',
      body: JSON.stringify({
        keputusan: decision.keputusan,
        ...(note ? { catatan_verifikasi: note } : {}),
        expected_version: decision.expected_version,
      }),
    }
  );
  if (!isAdminSubmissionResponse(result)) {
    throw new Error('Format hasil keputusan pengajuan dari API tidak sesuai kontrak.');
  }

  return result.data;
}
