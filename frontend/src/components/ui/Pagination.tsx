'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalData?: number;
  itemCount?: number;
  itemLabel?: string;
  disabled?: boolean;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalData,
  itemCount,
  itemLabel = 'data',
  disabled = false,
  className = '',
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safeCurrentPage = Math.min(Math.max(1, currentPage || 1), safeTotalPages);

  return (
    <nav
      aria-label="Navigasi halaman"
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4 font-inter ${className}`}
    >
      {totalData !== undefined ? (
        <p className="text-xs sm:text-sm text-ink-muted">
          Menampilkan {itemCount ?? totalData} dari {totalData} {itemLabel}
        </p>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="secondary"
          size="sm"
          disabled={safeCurrentPage <= 1 || disabled}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
          aria-label="Halaman sebelumnya"
        >
          Sebelumnya
        </Button>

        <span className="text-xs sm:text-sm font-medium text-ink px-2 select-none">
          Halaman {safeCurrentPage} dari {safeTotalPages}
        </span>

        <Button
          variant="secondary"
          size="sm"
          disabled={safeCurrentPage >= safeTotalPages || disabled}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          rightIcon={<ChevronRight className="w-4 h-4" />}
          aria-label="Halaman berikutnya"
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
