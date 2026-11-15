import type { KosFilterQuery, KosItem, KosMapMarker, KosMapMeta } from '@/types/kos';
import type { ApiResponse } from '@/types/api';
import {
  fetchKosListFromBackend,
  fetchKosMapFromBackend,
  fetchKosDetailFromBackend,
  buildClientSearchParams,
} from '@/lib/backendClient';

const isBrowser = typeof window !== 'undefined';

/**
 * Mengambil daftar kos publik.
 * - Browser: Memanggil same-origin proxy GET /api/kos (mencegah CORS dan kebocoran URL internal).
 * - Server: Memanggil backendClient langsung ke backend.
 * - Mendukung format pagination backend: { totalData, totalPages, currentPage, limit }.
 */
export async function getPublicKosList(
  filters: KosFilterQuery = {},
  options: { signal?: AbortSignal } = {}
): Promise<ApiResponse<KosItem[]>> {
  const { signal } = options;

  if (signal?.aborted) {
    const error = new Error('Pencarian dibatalkan.');
    error.name = 'AbortError';
    throw error;
  }

  // Jika dipanggil di sisi server (Server Component)
  if (!isBrowser) {
    return fetchKosListFromBackend(filters, options);
  }

  // Jika dipanggil di sisi browser (Client Component)
  const searchParams = buildClientSearchParams(filters);
  const url = `/api/kos?${searchParams.toString()}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });

    const json = (await res.json().catch(() => null)) as ApiResponse<KosItem[]> | null;

    if (!res.ok || !json?.success) {
      return {
        success: false,
        isNetworkError: res.status >= 500,
        isValidationError: res.status === 400,
        error: json?.error || json?.message || 'Layanan sedang tidak tersedia. Coba lagi beberapa saat.',
        data: [],
        totalCount: 0,
        totalPages: 1,
        page: Number(filters.page) || 1,
        perPage: Number(filters.limit ?? filters.perPage) || 4,
        isMock: false,
      };
    }

    const pagination = json.pagination;
    const totalCount =
      typeof pagination?.totalData === 'number'
        ? pagination.totalData
        : typeof json.totalCount === 'number'
        ? json.totalCount
        : typeof json.total === 'number'
        ? json.total
        : Array.isArray(json.data)
        ? json.data.length
        : 0;

    const totalPages =
      typeof pagination?.totalPages === 'number'
        ? pagination.totalPages
        : typeof json.totalPages === 'number'
        ? json.totalPages
        : 1;

    const page =
      typeof pagination?.currentPage === 'number'
        ? pagination.currentPage
        : typeof json.page === 'number'
        ? json.page
        : Number(filters.page) || 1;

    const limit =
      typeof pagination?.limit === 'number'
        ? pagination.limit
        : typeof json.perPage === 'number'
        ? json.perPage
        : typeof json.limit === 'number'
        ? json.limit
        : Number(filters.limit ?? filters.perPage) || 4;

    return {
      success: true,
      data: Array.isArray(json.data) ? json.data : [],
      totalCount,
      totalPages: Math.max(1, totalPages),
      page,
      perPage: limit,
      pagination: {
        totalData: totalCount,
        totalPages: Math.max(1, totalPages),
        currentPage: page,
        limit,
      },
      isMock: false,
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw error;
    }
    return {
      success: false,
      isNetworkError: true,
      error: 'Layanan sedang tidak tersedia. Coba lagi beberapa saat.',
      data: [],
      totalCount: 0,
      totalPages: 1,
      page: Number(filters.page) || 1,
      perPage: Number(filters.limit ?? filters.perPage) || 4,
      isMock: false,
    };
  }
}

/**
 * Mengambil marker peta kos publik.
 * - Browser: Memanggil same-origin proxy GET /api/kos/map.
 * - Server: Memanggil backendClient langsung ke backend.
 */
export async function getPublicKosMap(
  filters: KosFilterQuery = {},
  options: { signal?: AbortSignal } = {}
): Promise<ApiResponse<KosMapMarker[]> & KosMapMeta> {
  const { signal } = options;

  if (signal?.aborted) {
    const error = new Error('Pemuatan peta dibatalkan.');
    error.name = 'AbortError';
    throw error;
  }

  if (!isBrowser) {
    return fetchKosMapFromBackend(filters, options);
  }

  const searchParams = buildClientSearchParams(filters);
  const url = `/api/kos/map?${searchParams.toString()}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });

    const json = (await res.json().catch(() => null)) as (ApiResponse<KosMapMarker[]> & KosMapMeta) | null;

    if (!res.ok || !json?.success) {
      return {
        success: false,
        isNetworkError: res.status >= 500,
        isValidationError: res.status === 400,
        error: json?.error || json?.message || 'Layanan peta sedang tidak tersedia.',
        data: [],
        total: 0,
        limit: 500,
        truncated: false,
        totalCount: 0,
        isTruncated: false,
      };
    }

    const data = Array.isArray(json.data) ? json.data : [];
    const pagination = json.pagination;
    const total =
      typeof pagination?.totalData === 'number'
        ? pagination.totalData
        : typeof json.total === 'number'
        ? json.total
        : typeof json.totalCount === 'number'
        ? json.totalCount
        : data.length;

    const limit =
      typeof pagination?.limit === 'number'
        ? pagination.limit
        : typeof json.limit === 'number'
        ? json.limit
        : 500;

    const isTruncated =
      typeof json.isTruncated === 'boolean'
        ? json.isTruncated
        : typeof json.truncated === 'boolean'
        ? json.truncated
        : false;

    return {
      success: true,
      data,
      total,
      limit,
      truncated: isTruncated,
      totalCount: total,
      isTruncated,
      pagination: {
        totalData: total,
        totalPages: 1,
        currentPage: 1,
        limit,
      },
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw error;
    }
    return {
      success: false,
      isNetworkError: true,
      error: 'Layanan peta sedang tidak tersedia.',
      data: [],
      total: 0,
      limit: 500,
      truncated: false,
      totalCount: 0,
      isTruncated: false,
    };
  }
}

/**
 * Mengambil detail satu kos berdasarkan ID MongoDB.
 */
export async function getKosByIdOrSlug(
  idOrSlug: string,
  options: { signal?: AbortSignal } = {}
): Promise<ApiResponse<KosItem>> {
  const { signal } = options;

  if (signal?.aborted) {
    const error = new Error('Pemuatan detail kos dibatalkan.');
    error.name = 'AbortError';
    throw error;
  }

  if (!isBrowser) {
    return fetchKosDetailFromBackend(idOrSlug, options);
  }

  const url = `/api/kos/${encodeURIComponent(idOrSlug)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });

    const json = (await res.json().catch(() => null)) as ApiResponse<KosItem> | null;

    if (res.status === 404) {
      return {
        success: false,
        notFound: true,
        error: json?.error || 'Kos tidak ditemukan atau belum dipublikasikan.',
      };
    }

    if (res.status === 403) {
      return {
        success: false,
        unavailable: true,
        error: json?.error || 'Kos ini sedang dinonaktifkan atau dalam peninjauan admin.',
      };
    }

    if (!res.ok || !json?.success) {
      return {
        success: false,
        isNetworkError: res.status >= 500,
        isValidationError: res.status === 400,
        error: json?.error || json?.message || 'Layanan detail kos sedang tidak tersedia.',
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw error;
    }
    return {
      success: false,
      isNetworkError: true,
      error: 'Layanan sedang tidak tersedia. Coba lagi beberapa saat.',
    };
  }
}
