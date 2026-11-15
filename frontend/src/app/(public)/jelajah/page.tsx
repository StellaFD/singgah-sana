'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, SlidersHorizontal, Map, Grid, ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import KosGrid from '@/components/kos/KosGrid';
import ResultMap from '@/components/kos/ResultMap';
import FilterModal from '@/components/kos/FilterModal';
import Toast from '@/components/ui/Toast';
import { getPublicKosList, getPublicKosMap } from '@/features/kos/kosClient';
import type { KosItem, KosMapMarker } from '@/types/kos';
import { useFavorit } from '@/features/favorit/useFavorit';
import { parseSearchParams, updateCanonicalSearchParams } from '@/lib/queryUtils';

function JelajahContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL state synchronization: canonical menang lewat shared parser
  const parsed = useMemo(
    () => parseSearchParams(searchParams ?? new URLSearchParams()),
    [searchParams]
  );

  const {
    q: qParam,
    area_kampus: areaParam,
    tipe: tipeParam,
    harga_min: minPriceParam,
    harga_max: maxPriceParam,
    fasilitas: fasilitasParam,
    aturan: aturanParam,
    kamar_tersedia: availableOnlyParam,
    sort: sortParam,
    page: pageParam,
  } = parsed;

  const [kosList, setKosList] = useState<KosItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(pageParam);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [activeKosId, setActiveKosId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState<string>(qParam);

  const [mapMarkers, setMapMarkers] = useState<KosMapMarker[]>([]);
  const [mapTotalCount, setMapTotalCount] = useState<number>(0);
  const [isMapTruncated, setIsMapTruncated] = useState<boolean>(false);
  const [mapLoading, setMapLoading] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRetryTrigger, setMapRetryTrigger] = useState<number>(0);

  const { bookmarkedIds, toggleFavorit, toastMessage, clearToast } = useFavorit();

  const abortControllerRef = useRef<AbortController | null>(null);
  const mapAbortControllerRef = useRef<AbortController | null>(null);

  // Sinkronisasi back/forward navigation ke input search
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  // Helper untuk update query params URL: selalu hapus alias dan gunakan canonical
  const updateQuery = (newParams: Record<string, unknown>, resetPage = true) => {
    const updated = updateCanonicalSearchParams(
      new URLSearchParams(searchParams?.toString() ?? ''),
      newParams,
      resetPage
    );
    router.push(`${pathname}?${updated.toString()}`);
  };

  // Fetch daftar kos
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    getPublicKosList(
      {
        q: qParam,
        area_kampus: areaParam,
        tipe: tipeParam,
        harga_min: minPriceParam,
        harga_max: maxPriceParam,
        fasilitas: fasilitasParam,
        aturan: aturanParam,
        kamar_tersedia: availableOnlyParam,
        sort: sortParam,
        page: pageParam,
        limit: 8,
      },
      { signal: controller.signal }
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.success) {
          const pagination = res.pagination;
          const total = typeof pagination?.totalData === 'number' ? pagination.totalData : (res.totalCount || 0);
          const pages = typeof pagination?.totalPages === 'number' ? pagination.totalPages : (res.totalPages || 1);
          const current = typeof pagination?.currentPage === 'number' ? pagination.currentPage : (res.page || 1);

          setKosList(res.data || []);
          setTotalCount(total);
          setMapTotalCount((prev) => (prev === 0 ? total : prev));
          setTotalPages(pages);
          setCurrentPage(current);
        } else {
          setError(res.error || 'Gagal memuat data kos.');
        }
      })
      .catch((err: unknown) => {
        const error = err as Error;
        if (controller.signal.aborted || error.name === 'AbortError') return;
        setError('Terjadi kendala jaringan saat menghubungi server kos.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [
    qParam,
    areaParam,
    tipeParam,
    minPriceParam,
    maxPriceParam,
    fasilitasParam,
    aturanParam,
    availableOnlyParam,
    sortParam,
    pageParam,
    retryTrigger,
  ]);

  // Fetch marker peta saat mode peta aktif
  useEffect(() => {
    if (!showMap) return;

    if (mapAbortControllerRef.current) {
      mapAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    mapAbortControllerRef.current = controller;

    // Bersihkan marker lama segera agar tidak menampilkan marker stale saat filter berubah
    setMapMarkers([]);
    setMapLoading(true);
    setMapError(null);

    getPublicKosMap(
      {
        q: qParam,
        area_kampus: areaParam,
        tipe: tipeParam,
        harga_min: minPriceParam,
        harga_max: maxPriceParam,
        fasilitas: fasilitasParam,
        aturan: aturanParam,
        kamar_tersedia: availableOnlyParam,
      },
      { signal: controller.signal }
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.success) {
          const total = typeof res.total === 'number' ? res.total : (res.totalCount || res.data?.length || 0);
          setMapMarkers(res.data || []);
          setMapTotalCount(total);
          setTotalCount((prev) => (prev === 0 ? total : prev));
          setIsMapTruncated(Boolean(res.isTruncated || res.truncated));
        } else {
          setMapError(res.error || 'Gagal memuat data peta.');
        }
      })
      .catch((err: unknown) => {
        const error = err as Error;
        if (controller.signal.aborted || error.name === 'AbortError') return;
        setMapError('Terjadi kendala jaringan saat memuat peta kos.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setMapLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [
    showMap,
    qParam,
    areaParam,
    tipeParam,
    minPriceParam,
    maxPriceParam,
    fasilitasParam,
    aturanParam,
    availableOnlyParam,
    mapRetryTrigger,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ q: searchInput });
  };

  const handleResetAll = () => {
    setSearchInput('');
    router.push('/jelajah');
  };

  const handleSelectKosOnMap = useCallback((kos: KosMapMarker) => {
    setActiveKosId(kos?.id || kos?._id || null);
  }, []);

  // Penentuan teks ringkasan hasil secara konsisten dan adaptif terhadap mode & status error
  const summaryText = useMemo(() => {
    if (showMap) {
      if (mapLoading) return 'Memperbarui lokasi kos di peta...';
      if (mapError) return 'Jumlah hasil belum dapat dimuat.';
      return `Menampilkan ${mapTotalCount} pilihan kos yang terdaftar.`;
    }

    if (loading) return 'Memuat kos sesuai pencarianmu...';
    if (error) return 'Jumlah hasil belum dapat dimuat.';
    return `Menampilkan ${totalCount} pilihan kos yang terdaftar.`;
  }, [showMap, mapLoading, mapError, mapTotalCount, loading, error, totalCount]);

  return (
    <div className="flex flex-col min-h-screen bg-white font-inter">
      {/* 1. Header Kontrol & Filter Bar */}
      <section className="sticky top-[88px] z-30 w-full bg-white/95 backdrop-blur-md border-b border-surface-border py-4 px-6 sm:px-12 lg:px-16">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Form Pencarian Cepat */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="Cari nama kos, area, atau fasilitas..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-border bg-surface-subtle text-sm text-ink placeholder-ink-light focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-ink-muted" />
          </form>

          {/* Tombol Aksi: Filter Modal, Urutkan & Tampilan Grid/Peta */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Kontrol Sorting */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="jelajah-sort" className="text-xs font-medium text-ink-muted shrink-0 hidden sm:inline">
                Urutkan:
              </label>
              <select
                id="jelajah-sort"
                value={sortParam}
                onChange={(e) => updateQuery({ sort: e.target.value })}
                className="bg-surface-subtle border border-surface-border text-xs font-medium text-ink rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
              >
                <option value="terbaru">Terbaru</option>
                <option value="harga_asc">Harga Terendah</option>
                <option value="harga_desc">Harga Tertinggi</option>
                <option value="kamar_banyak">Sisa Kamar</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="md"
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
              onClick={() => setFilterModalOpen(true)}
            >
              Filter
            </Button>

            {/* Toggle Grid vs Peta */}
            <div className="inline-flex items-center bg-surface-subtle p-1 rounded-xl border border-surface-border">
              <button
                type="button"
                onClick={() => setShowMap(false)}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  !showMap
                    ? 'bg-white text-brand-primary shadow-xs font-semibold'
                    : 'text-ink-muted hover:text-ink'
                }`}
                aria-label="Tampilan Grid"
              >
                <Grid className="w-4 h-4" />
                <span className="hidden sm:inline">Daftar</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  showMap
                    ? 'bg-white text-brand-primary shadow-xs font-semibold'
                    : 'text-ink-muted hover:text-ink'
                }`}
                aria-label="Tampilan Peta"
              >
                <Map className="w-4 h-4" />
                <span className="hidden sm:inline">Peta</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Konten Hasil Jelajah */}
      <div className="max-w-[1440px] mx-auto w-full px-6 sm:px-12 lg:px-16 py-8 flex-1 flex flex-col gap-6">
        {/* Ringkasan Hasil */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-sora font-semibold text-2xl text-ink">
              {areaParam && areaParam !== 'Semua Area' ? `Kos di ${areaParam}` : 'Temukan kos di Indonesia'}
            </h1>
            <p className="text-sm text-ink-muted mt-0.5">
              {summaryText}
            </p>
          </div>
        </div>

        {/* Area Tampilan: Grid atau Peta */}
        {showMap ? (
          <div className="relative w-full h-[650px] rounded-2xl overflow-hidden border border-surface-border shadow-xs">
            {mapLoading ? (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-ink-muted font-medium">Memperbarui lokasi peta...</p>
              </div>
            ) : mapError ? (
              <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-3 p-6 text-center z-20">
                <p className="text-sm font-medium text-red-600">{mapError}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMapRetryTrigger((prev) => prev + 1)}
                >
                  Coba Lagi
                </Button>
              </div>
            ) : mapMarkers.length === 0 ? (
              <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 p-6 text-center z-20">
                <p className="text-sm font-semibold text-ink font-sora">
                  Tidak ada kos dengan titik lokasi pada kriteria ini
                </p>
                <p className="text-xs text-ink-muted max-w-sm">
                  Coba ubah filter atau atur ulang pencarian untuk melihat listing kos lainnya.
                </p>
                <Button variant="secondary" size="sm" onClick={handleResetAll} className="mt-2">
                  Reset Filter
                </Button>
              </div>
            ) : null}

            <ResultMap
              kosList={mapMarkers}
              activeKosId={activeKosId}
              onSelectKos={handleSelectKosOnMap}
              isTruncated={isMapTruncated}
            />
          </div>
        ) : (
          <KosGrid
            kosList={kosList}
            loading={loading}
            error={error}
            onRetry={() => setRetryTrigger((prev) => prev + 1)}
            onBookmark={(kos) => toggleFavorit(kos.id || kos._id)}
            bookmarkedIds={bookmarkedIds}
            onResetFilters={handleResetAll}
          />
        )}

        {/* Paginasi (khusus mode daftar) */}
        {!showMap && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8 border-t border-surface-border">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => updateQuery({ page: currentPage - 1 }, false)}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Sebelumnya
            </Button>
            <span className="text-xs text-ink-muted px-3">
              Halaman {currentPage} dari {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => updateQuery({ page: currentPage + 1 }, false)}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Berikutnya
            </Button>
          </div>
        )}
      </div>

      {/* Modal Filter */}
      <FilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        initialFilters={{
          minPrice: minPriceParam,
          maxPrice: maxPriceParam,
          tipe: tipeParam,
          fasilitas: fasilitasParam,
          aturan: aturanParam,
          availableOnly: availableOnlyParam,
        }}
        onApply={(applied) => updateQuery(applied)}
      />

      {/* Toast Notifikasi Favorit */}
      <Toast
        isOpen={Boolean(toastMessage)}
        message={toastMessage}
        onClose={clearToast}
        type="info"
      />
    </div>
  );
}

export default function JelajahPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-ink-muted">Memuat halaman jelajah...</div>}>
      <JelajahContent />
    </Suspense>
  );
}
