/**
 * Client Server-Side untuk Komunikasi Langsung ke Backend RESTful API
 * Singgah-sana (PAW DTETI FT UGM)
 *
 * Menggunakan konfigurasi API_BASE_URL server-only (default: http://127.0.0.1:5000/api).
 * Mencegah kebocoran credential dan SSRF via origin tetap.
 */

import type { KosFilterQuery, KosItem, KosMapMarker, KosMapMeta } from '@/types/kos';
import type { ApiResponse, ApiPagination } from '@/types/api';
import { normalizeKosItem, normalizeKosMapMarker, getBackendApiUrl } from './normalizer';
import { buildBackendSearchParams, buildClientSearchParams } from './queryUtils';

export {
  normalizeKosItem,
  normalizeKosMapMarker,
  buildBackendSearchParams,
  buildClientSearchParams,
};

interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface ParsedHttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
}

/**
 * Helper fetch dengan timeout yang mengikat hingga seluruh pembacaan body JSON selesai.
 * res.json() dieksekusi di dalam rentang waktu hidup timer (bukan setelah timer di-clear).
 */
async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<ParsedHttpResponse<T>> {
  const { timeoutMs = 8000, signal: externalSignal, ...fetchOptions } = options;
  const timeoutController = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);

  const abortListener = () => {
    timeoutController.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      const err = new Error('Operasi dibatalkan.');
      err.name = 'AbortError';
      throw err;
    }
    externalSignal.addEventListener('abort', abortListener, { once: true });
  }

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: timeoutController.signal,
    });

    // Pembacaan payload JSON dilakukan di dalam blok try sebelum timer dibersihkan
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      if (externalSignal?.aborted) {
        const err = new Error('Operasi dibatalkan.');
        err.name = 'AbortError';
        throw err;
      }
      if (timedOut) {
        const error = new Error(`Permintaan ke backend melampaui batas waktu (${timeoutMs}ms).`);
        error.name = 'TimeoutError';
        throw error;
      }
      if (res.ok) {
        // HTTP 200 tetapi JSON malformed/bukan JSON valid -> upstream error, jangan telan sebagai null/sukses
        const error = new Error('Format respons upstream bukan JSON valid.');
        error.name = 'UpstreamParseError';
        throw error;
      }
      data = null;
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  } catch (err: unknown) {
    if (externalSignal?.aborted) {
      const error = new Error('Operasi dibatalkan.');
      error.name = 'AbortError';
      throw error;
    }
    if (timedOut) {
      const error = new Error(`Permintaan ke backend melampaui batas waktu (${timeoutMs}ms).`);
      error.name = 'TimeoutError';
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortListener);
    }
  }
}

/**
 * Mengambil daftar kos publik dari backend Express
 * Mendukung format respons backend aktual pagination: { totalData, totalPages, currentPage, limit }
 */
export async function fetchKosListFromBackend(
  filters: KosFilterQuery = {},
  options: FetchOptions = {}
): Promise<ApiResponse<KosItem[]>> {
  const { signal, timeoutMs = 8000 } = options;

  if (signal?.aborted) {
    const error = new Error('Pencarian dibatalkan.');
    error.name = 'AbortError';
    throw error;
  }

  const queryParams = buildBackendSearchParams(filters);
  const backendBase = getBackendApiUrl();
  const url = `${backendBase}/kos?${queryParams.toString()}`;

  try {
    const res = await fetchJsonWithTimeout<Record<string, unknown>>(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
      timeoutMs,
    });

    const json = res.data;

    if (!res.ok) {
      return {
        success: false,
        isNetworkError: res.status >= 500,
        isValidationError: res.status === 400,
        error:
          typeof json?.error === 'string'
            ? json.error
            : typeof json?.message === 'string'
            ? json.message
            : `Gagal memuat daftar kos (HTTP ${res.status}).`,
        data: [],
        totalCount: 0,
        totalPages: 1,
        page: Number(filters.page) || 1,
        perPage: Number(filters.limit ?? filters.perPage) || 4,
        isMock: false,
      };
    }

    // Tangani jika upstream mengembalikan status HTTP 200 tetapi { success: false, ... }
    if (json && typeof json === 'object' && json.success === false) {
      return {
        success: false,
        error:
          typeof json.error === 'string'
            ? json.error
            : typeof json.message === 'string'
            ? json.message
            : 'Permintaan gagal diproses oleh upstream backend.',
        data: [],
        totalCount: 0,
        totalPages: 1,
        page: Number(filters.page) || 1,
        perPage: Number(filters.limit ?? filters.perPage) || 4,
        isMock: false,
      };
    }

    const rawList = Array.isArray(json?.data) ? json.data : [];
    const normalizedList: KosItem[] = [];

    for (const item of rawList) {
      const normalized = normalizeKosItem(item);
      if (normalized) {
        normalizedList.push(normalized);
      }
    }

    // Ekstraksi pagination dari format backend aktual { totalData, totalPages, currentPage, limit }
    const paginationRaw =
      json?.pagination && typeof json.pagination === 'object'
        ? (json.pagination as Record<string, unknown>)
        : null;

    const limit =
      typeof paginationRaw?.limit === 'number'
        ? paginationRaw.limit
        : typeof json?.limit === 'number'
        ? json.limit
        : typeof json?.perPage === 'number'
        ? json.perPage
        : Number(filters.limit ?? filters.perPage) || 4;

    const totalCount =
      typeof paginationRaw?.totalData === 'number'
        ? paginationRaw.totalData
        : typeof json?.totalCount === 'number'
        ? json.totalCount
        : typeof json?.total === 'number'
        ? json.total
        : normalizedList.length;

    const totalPages =
      typeof paginationRaw?.totalPages === 'number'
        ? paginationRaw.totalPages
        : typeof json?.totalPages === 'number'
        ? json.totalPages
        : Math.max(1, Math.ceil(totalCount / limit));

    const currentPage =
      typeof paginationRaw?.currentPage === 'number'
        ? paginationRaw.currentPage
        : typeof json?.page === 'number'
        ? json.page
        : Number(filters.page) || 1;

    const pagination: ApiPagination = {
      totalData: totalCount,
      totalPages,
      currentPage,
      limit,
    };

    return {
      success: true,
      data: normalizedList,
      totalCount,
      totalPages,
      page: currentPage,
      perPage: limit,
      total: totalCount,
      limit,
      pagination,
      isMock: false,
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError' || signal?.aborted) {
      const abortErr = new Error('Pencarian dibatalkan.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    const isParseErr = error.name === 'UpstreamParseError';
    return {
      success: false,
      isNetworkError: !isParseErr,
      error: isParseErr
        ? 'Format data upstream tidak valid atau rusak.'
        : 'Layanan sedang tidak tersedia. Coba lagi beberapa saat.',
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
 * Mengambil marker peta kos publik dari backend Express
 */
export async function fetchKosMapFromBackend(
  filters: KosFilterQuery = {},
  options: FetchOptions = {}
): Promise<ApiResponse<KosMapMarker[]> & KosMapMeta> {
  const { signal, timeoutMs = 8000 } = options;

  if (signal?.aborted) {
    const error = new Error('Pemuatan peta dibatalkan.');
    error.name = 'AbortError';
    throw error;
  }

  const queryParams = buildBackendSearchParams(filters);
  const backendBase = getBackendApiUrl();
  const url = `${backendBase}/kos/map?${queryParams.toString()}`;

  try {
    const res = await fetchJsonWithTimeout<Record<string, unknown>>(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
      timeoutMs,
    });

    const json = res.data;

    if (!res.ok) {
      return {
        success: false,
        isNetworkError: res.status >= 500,
        isValidationError: res.status === 400,
        error:
          typeof json?.error === 'string'
            ? json.error
            : typeof json?.message === 'string'
            ? json.message
            : `Gagal memuat peta kos (HTTP ${res.status}).`,
        data: [],
        total: 0,
        limit: 500,
        truncated: false,
        totalCount: 0,
        isTruncated: false,
      };
    }

    if (json && typeof json === 'object' && json.success === false) {
      return {
        success: false,
        error:
          typeof json.error === 'string'
            ? json.error
            : typeof json.message === 'string'
            ? json.message
            : 'Permintaan gagal diproses oleh upstream backend.',
        data: [],
        total: 0,
        limit: 500,
        truncated: false,
        totalCount: 0,
        isTruncated: false,
      };
    }

    const rawMarkers = Array.isArray(json?.data) ? json.data : [];
    const validMarkers: KosMapMarker[] = [];

    for (const marker of rawMarkers) {
      const normalized = normalizeKosMapMarker(marker);
      if (normalized) {
        validMarkers.push(normalized);
      }
    }

    const paginationRaw =
      json?.pagination && typeof json.pagination === 'object'
        ? (json.pagination as Record<string, unknown>)
        : null;

    const totalCount =
      typeof paginationRaw?.totalData === 'number'
        ? paginationRaw.totalData
        : typeof json?.totalCount === 'number'
        ? json.totalCount
        : typeof json?.total === 'number'
        ? json.total
        : validMarkers.length;

    const limit = typeof json?.limit === 'number' ? json.limit : 500;
    const isTruncated =
      typeof json?.isTruncated === 'boolean'
        ? json.isTruncated
        : typeof json?.truncated === 'boolean'
        ? json.truncated
        : totalCount > validMarkers.length;

    return {
      success: true,
      data: validMarkers,
      total: totalCount,
      limit,
      truncated: isTruncated,
      totalCount,
      isTruncated,
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError' || signal?.aborted) {
      const abortErr = new Error('Pemuatan peta dibatalkan.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    const isParseErr = error.name === 'UpstreamParseError';
    return {
      success: false,
      isNetworkError: !isParseErr,
      error: isParseErr
        ? 'Format data upstream tidak valid atau rusak.'
        : 'Layanan sedang tidak tersedia. Coba lagi beberapa saat.',
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
 * Mengambil detail kos berdasarkan ID MongoDB dari backend Express
 */
export async function fetchKosDetailFromBackend(
  id: string,
  options: FetchOptions = {}
): Promise<ApiResponse<KosItem>> {
  const { signal, timeoutMs = 8000 } = options;

  if (signal?.aborted) {
    const error = new Error('Pemuatan detail kos dibatalkan.');
    error.name = 'AbortError';
    throw error;
  }

  const cleanId = encodeURIComponent(id.trim());
  const backendBase = getBackendApiUrl();
  const url = `${backendBase}/kos/${cleanId}`;

  try {
    const res = await fetchJsonWithTimeout<Record<string, unknown>>(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
      timeoutMs,
    });

    const json = res.data;

    if (res.status === 404) {
      return {
        success: false,
        notFound: true,
        error: typeof json?.error === 'string' ? json.error : 'Kos tidak ditemukan atau belum dipublikasikan.',
      };
    }

    if (res.status === 403) {
      return {
        success: false,
        unavailable: true,
        error: typeof json?.error === 'string' ? json.error : 'Kos ini sedang dinonaktifkan atau dalam peninjauan admin.',
      };
    }

    if (!res.ok) {
      return {
        success: false,
        isNetworkError: res.status >= 500,
        isValidationError: res.status === 400,
        error:
          typeof json?.error === 'string'
            ? json.error
            : typeof json?.message === 'string'
            ? json.message
            : `Gagal memuat detail kos (HTTP ${res.status}).`,
      };
    }

    if (json && typeof json === 'object' && json.success === false) {
      return {
        success: false,
        error:
          typeof json.error === 'string'
            ? json.error
            : typeof json.message === 'string'
            ? json.message
            : 'Permintaan gagal diproses oleh upstream backend.',
      };
    }

    const rawData = json?.data ?? json;
    const normalized = normalizeKosItem(rawData);

    if (!normalized) {
      return {
        success: false,
        unavailable: true,
        error: 'Data kos tidak valid atau tidak memenuhi kriteria publikasi.',
      };
    }

    return {
      success: true,
      data: normalized,
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError' || signal?.aborted) {
      const abortErr = new Error('Pemuatan detail kos dibatalkan.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    const isParseErr = error.name === 'UpstreamParseError';
    return {
      success: false,
      isNetworkError: !isParseErr,
      error: isParseErr
        ? 'Format data upstream tidak valid atau rusak.'
        : 'Layanan sedang tidak tersedia. Coba lagi beberapa saat.',
    };
  }
}
