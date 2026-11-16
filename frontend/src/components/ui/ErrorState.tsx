import React from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export default function ErrorState({
  title = 'Terjadi Kendala',
  message = 'Data belum dapat dimuat saat ini. Silakan periksa koneksi Anda dan coba lagi.',
  onRetry,
  retryLabel = 'Coba lagi',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-red-50/50 rounded-2xl border border-red-200 font-inter ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7" aria-hidden="true" />
      </div>
      <h3 className="text-base sm:text-lg font-bold font-sora text-red-900 mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-red-700 max-w-md mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
