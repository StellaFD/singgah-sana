/**
 * Utilitas Pengelolaan Query Filter Pencarian Kos
 * Menyelaraskan nama parameter kanonis (q, tipe, harga_min, harga_max, fasilitas,
 * kamar_tersedia, area_kampus, sort, page, limit) dengan alias antarmuka lama
 * (minPrice, maxPrice, availableOnly, area, perPage).
 *
 * Aturan Utama: Parameter kanonis SELALU menang atas alias antarmuka, termasuk nilai falsy (false, 0, '').
 */

import type { KosFilterQuery } from '@/types/kos';

/**
 * Membangun URLSearchParams untuk pemanggilan API Backend Express.
 * Memastikan parameter yang dikirim menggunakan nama kanonis backend.
 * Parameter kanonis menang atas alias, termasuk nilai false.
 */
export function buildBackendSearchParams(filters: KosFilterQuery = {}): URLSearchParams {
  const params = new URLSearchParams();

  // Query kata kunci (q)
  if (filters.q !== undefined && filters.q !== null && typeof filters.q === 'string' && filters.q.trim()) {
    params.set('q', filters.q.trim());
  }

  // Tipe kos (putra / putri / campur)
  if (filters.tipe !== undefined && filters.tipe !== null && filters.tipe !== 'all' && String(filters.tipe).trim()) {
    params.set('tipe', String(filters.tipe).trim());
  }

  // Area kampus: area_kampus kanonis MENANG atas alias area
  const rawArea = filters.area_kampus !== undefined ? filters.area_kampus : filters.area;
  if (rawArea !== undefined && rawArea !== null && rawArea !== 'Semua Area' && typeof rawArea === 'string' && rawArea.trim()) {
    const cleanArea = rawArea.replace(', sekitar UGM', '').replace(' sekitar UGM', '').trim();
    if (cleanArea) {
      params.set('area_kampus', cleanArea);
    }
  }

  // Rentang harga minimum: harga_min kanonis MENANG atas alias minPrice
  const rawMin = filters.harga_min !== undefined ? filters.harga_min : filters.minPrice;
  if (rawMin !== undefined && rawMin !== null && String(rawMin).trim() !== '') {
    params.set('harga_min', String(rawMin).trim());
  }

  // Rentang harga maksimum: harga_max kanonis MENANG atas alias maxPrice
  const rawMax = filters.harga_max !== undefined ? filters.harga_max : filters.maxPrice;
  if (rawMax !== undefined && rawMax !== null && String(rawMax).trim() !== '') {
    params.set('harga_max', String(rawMax).trim());
  }

  // Fasilitas (array atau string dipisahkan koma)
  if (filters.fasilitas) {
    if (Array.isArray(filters.fasilitas) && filters.fasilitas.length > 0) {
      params.set('fasilitas', filters.fasilitas.join(','));
    } else if (typeof filters.fasilitas === 'string' && filters.fasilitas.trim()) {
      params.set('fasilitas', filters.fasilitas.trim());
    }
  }

  // Aturan kos
  if (filters.aturan) {
    if (Array.isArray(filters.aturan) && filters.aturan.length > 0) {
      params.set('aturan', filters.aturan.join(','));
    } else if (typeof filters.aturan === 'string' && filters.aturan.trim()) {
      params.set('aturan', filters.aturan.trim());
    }
  }

  // Ketersediaan kamar: kamar_tersedia kanonis MENANG atas alias availableOnly (termasuk nilai false)
  let isAvailable: boolean | null = null;
  if (filters.kamar_tersedia !== undefined && filters.kamar_tersedia !== null) {
    isAvailable = filters.kamar_tersedia === true || filters.kamar_tersedia === 'true';
  } else if (filters.availableOnly !== undefined && filters.availableOnly !== null) {
    isAvailable = filters.availableOnly === true || filters.availableOnly === 'true';
  }

  if (isAvailable === true) {
    params.set('kamar_tersedia', 'true');
  }

  // Sorting
  if (filters.sort && typeof filters.sort === 'string' && filters.sort.trim()) {
    params.set('sort', filters.sort.trim());
  }

  // Paginasi: Halaman (page)
  if (filters.page !== undefined && filters.page !== null) {
    const pageNum = parseInt(String(filters.page), 10);
    if (!Number.isNaN(pageNum) && pageNum > 0) {
      params.set('page', String(pageNum));
    }
  }

  // Paginasi: Limit (limit kanonis MENANG atas alias perPage)
  const rawLimit = filters.limit !== undefined ? filters.limit : filters.perPage;
  if (rawLimit !== undefined && rawLimit !== null) {
    const limitNum = parseInt(String(rawLimit), 10);
    if (!Number.isNaN(limitNum) && limitNum > 0) {
      params.set('limit', String(limitNum));
    }
  }

  return params;
}

/**
 * Membangun URLSearchParams untuk sinkronisasi URL di sisi peramban (Client Component).
 * Mendukung alias antarmuka dan canonical parameters.
 * Parameter kanonis menang atas alias, termasuk nilai false.
 */
export function buildClientSearchParams(filters: KosFilterQuery = {}): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q !== undefined && filters.q !== null && typeof filters.q === 'string' && filters.q.trim()) {
    params.set('q', filters.q.trim());
  }

  if (filters.tipe !== undefined && filters.tipe !== null && filters.tipe !== 'all' && String(filters.tipe).trim()) {
    params.set('tipe', String(filters.tipe).trim());
  }

  const rawArea = filters.area_kampus !== undefined ? filters.area_kampus : filters.area;
  if (rawArea !== undefined && rawArea !== null && rawArea !== 'Semua Area' && typeof rawArea === 'string' && rawArea.trim()) {
    params.set('area', rawArea.trim());
  }

  const rawMin = filters.harga_min !== undefined ? filters.harga_min : filters.minPrice;
  if (rawMin !== undefined && rawMin !== null && String(rawMin).trim() !== '') {
    params.set('minPrice', String(rawMin).trim());
  }

  const rawMax = filters.harga_max !== undefined ? filters.harga_max : filters.maxPrice;
  if (rawMax !== undefined && rawMax !== null && String(rawMax).trim() !== '') {
    params.set('maxPrice', String(rawMax).trim());
  }

  if (filters.fasilitas) {
    if (Array.isArray(filters.fasilitas) && filters.fasilitas.length > 0) {
      params.set('fasilitas', filters.fasilitas.join(','));
    } else if (typeof filters.fasilitas === 'string' && filters.fasilitas.trim()) {
      params.set('fasilitas', filters.fasilitas.trim());
    }
  }

  if (filters.aturan) {
    if (Array.isArray(filters.aturan) && filters.aturan.length > 0) {
      params.set('aturan', filters.aturan.join(','));
    } else if (typeof filters.aturan === 'string' && filters.aturan.trim()) {
      params.set('aturan', filters.aturan.trim());
    }
  }

  // kamar_tersedia kanonis menang atas availableOnly termasuk false
  let isAvailable: boolean | null = null;
  if (filters.kamar_tersedia !== undefined && filters.kamar_tersedia !== null) {
    isAvailable = filters.kamar_tersedia === true || filters.kamar_tersedia === 'true';
  } else if (filters.availableOnly !== undefined && filters.availableOnly !== null) {
    isAvailable = filters.availableOnly === true || filters.availableOnly === 'true';
  }

  if (isAvailable === true) {
    params.set('availableOnly', 'true');
  }

  if (filters.sort && typeof filters.sort === 'string' && filters.sort.trim()) {
    params.set('sort', filters.sort.trim());
  }

  if (filters.page !== undefined && filters.page !== null) {
    const pageNum = parseInt(String(filters.page), 10);
    if (!Number.isNaN(pageNum) && pageNum > 0) {
      params.set('page', String(pageNum));
    }
  }

  const rawPerPage = filters.limit !== undefined ? filters.limit : filters.perPage;
  if (rawPerPage !== undefined && rawPerPage !== null) {
    const perPageNum = parseInt(String(rawPerPage), 10);
    if (!Number.isNaN(perPageNum) && perPageNum > 0) {
      params.set('perPage', String(perPageNum));
    }
  }

  return params;
}

export interface ParsedFilterParams {
  q: string;
  area_kampus: string;
  tipe: string;
  harga_min: string;
  harga_max: string;
  fasilitas: string[];
  aturan: string[];
  kamar_tersedia: boolean;
  sort: string;
  page: number;
  limit: number;
}

/**
 * Parser URL searchParams bersama.
 * Menjamin parameter kanonis SELALU menang atas alias antarmuka lama (termasuk nilai boolean false).
 */
export function parseSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null; has?: (key: string) => boolean }
): ParsedFilterParams {
  const getVal = (key: string): string | null => searchParams.get(key);
  const hasKey = (key: string): boolean =>
    typeof searchParams.has === 'function' ? searchParams.has(key) : searchParams.get(key) !== null;

  const q = getVal('q') || '';

  // Canonical area_kampus MENANG atas alias area
  const area_kampus = hasKey('area_kampus')
    ? (getVal('area_kampus') || '')
    : (getVal('area') || '');

  const tipe = getVal('tipe') || 'all';

  // Canonical harga_min MENANG atas alias minPrice
  const harga_min = hasKey('harga_min')
    ? (getVal('harga_min') || '')
    : (getVal('minPrice') || '');

  // Canonical harga_max MENANG atas alias maxPrice
  const harga_max = hasKey('harga_max')
    ? (getVal('harga_max') || '')
    : (getVal('maxPrice') || '');

  const fasilitasStr = getVal('fasilitas') || '';
  const fasilitas = fasilitasStr
    ? fasilitasStr.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const aturanStr = getVal('aturan') || '';
  const aturan = aturanStr
    ? aturanStr.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Canonical kamar_tersedia MENANG atas alias availableOnly (termasuk nilai false)
  let kamar_tersedia = false;
  if (hasKey('kamar_tersedia')) {
    const v = getVal('kamar_tersedia');
    kamar_tersedia = v === 'true';
  } else if (hasKey('availableOnly')) {
    const v = getVal('availableOnly');
    kamar_tersedia = v === 'true';
  }

  const sort = getVal('sort') || 'terbaru';
  const page = parseInt(getVal('page') || '1', 10) || 1;
  const rawLimit = hasKey('limit') ? getVal('limit') : getVal('perPage');
  const limit = parseInt(rawLimit || '8', 10) || 8;

  return {
    q,
    area_kampus,
    tipe,
    harga_min,
    harga_max,
    fasilitas,
    aturan,
    kamar_tersedia,
    sort,
    page,
    limit,
  };
}

/**
 * Memperbarui URLSearchParams dengan parameter kanonis dan MENGHAPUS alias lama.
 */
export function updateCanonicalSearchParams(
  currentParams: URLSearchParams,
  newFilters: Record<string, unknown>,
  resetPage = true
): URLSearchParams {
  const updated = new URLSearchParams(currentParams.toString());

  const aliasMapping: Record<string, string> = {
    minPrice: 'harga_min',
    maxPrice: 'harga_max',
    availableOnly: 'kamar_tersedia',
    area: 'area_kampus',
    perPage: 'limit',
  };

  Object.entries(newFilters).forEach(([key, rawVal]) => {
    const canonicalKey = aliasMapping[key] || key;
    const legacyKey = Object.keys(aliasMapping).find((k) => aliasMapping[k] === canonicalKey);

    // Bersihkan alias lama
    if (legacyKey) {
      updated.delete(legacyKey);
    }
    updated.delete(canonicalKey);

    if (
      rawVal === undefined ||
      rawVal === null ||
      rawVal === '' ||
      rawVal === 'all' ||
      rawVal === 'Semua Area' ||
      rawVal === false ||
      (Array.isArray(rawVal) && rawVal.length === 0)
    ) {
      // Nilai kosong/default -> tidak perlu dimasukkan ke URL
    } else if (Array.isArray(rawVal)) {
      updated.set(canonicalKey, rawVal.join(','));
    } else {
      updated.set(canonicalKey, String(rawVal));
    }
  });

  if (resetPage && !('page' in newFilters)) {
    updated.delete('page');
  }

  return updated;
}
