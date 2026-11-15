import React from 'react';
import { SearchX } from 'lucide-react';
import Button from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon,
  title = 'Tidak Ada Data',
  description = 'Data kos yang Anda cari belum ditemukan atau tidak memenuhi kriteria filter.',
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-surface-border font-inter ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-brand-lavender text-brand-primary flex items-center justify-center mb-4">
        {icon || <SearchX className="w-8 h-8" />}
      </div>
      <h3 className="text-lg font-bold font-sora text-ink mb-1.5">{title}</h3>
      <p className="text-sm text-ink-muted max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
