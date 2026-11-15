import React from 'react';
import type { KosItem } from '@/types/kos';
import KosCard from './KosCard';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

export interface KosGridProps {
  kosList?: KosItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onBookmark?: (kos: KosItem) => void;
  bookmarkedIds?: string[];
  columns?: string;
  emptyMessage?: string;
  onResetFilters?: () => void;
}

export default function KosGrid({
  kosList = [],
  loading = false,
  error = null,
  onRetry,
  onBookmark,
  bookmarkedIds = [],
  columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  emptyMessage,
  onResetFilters,
}: KosGridProps) {
  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className={`grid ${columns} gap-6`}>
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="bg-white rounded-2xl border border-surface-border overflow-hidden flex flex-col"
          >
            <Skeleton className="h-[214px] w-full rounded-none" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-1/2" />
              <div className="pt-3 border-t border-surface-border flex justify-between items-center">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 2. Error State dengan Tombol Retry
  if (error) {
    return (
      <div className="w-full py-12 px-6 rounded-2xl border border-red-200 bg-red-50 text-center font-inter space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <span className="text-xl font-bold">!</span>
        </div>
        <div>
          <h3 className="font-sora font-semibold text-lg text-ink">
            Gagal Memuat Daftar Kos
          </h3>
          <p className="text-sm text-ink-muted max-w-md mx-auto mt-1">
            {error}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-hover transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
        )}
      </div>
    );
  }

  // 3. Empty State (Tidak Ada Hasil Sesuai Filter)
  if (kosList.length === 0) {
    return (
      <EmptyState
        title="Tidak Ada Kos yang Cocok"
        description={
          emptyMessage ||
          'Kriteria pencarian atau filter yang Anda pilih saat ini belum memiliki kos yang sesuai di lokasi yang dipilih.'
        }
        actionLabel={onResetFilters ? 'Reset Semua Filter' : undefined}
        onAction={onResetFilters}
      />
    );
  }

  // 4. Grid Kartu Kos
  return (
    <div className={`grid ${columns} gap-6`}>
      {kosList.map((kos) => (
        <KosCard
          key={kos.id || kos._id}
          kos={kos}
          onBookmark={onBookmark}
          isBookmarked={bookmarkedIds.includes(kos.id || kos._id)}
        />
      ))}
    </div>
  );
}
