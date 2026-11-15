'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  isOpen?: boolean;
  onClose?: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = 'info',
  isOpen = false,
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (isOpen && duration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const typeConfig: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
    success: {
      bg: 'bg-green-50 border-green-200 text-green-800',
      icon: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />,
    },
    error: {
      bg: 'bg-red-50 border-red-200 text-red-800',
      icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
    },
    info: {
      bg: 'bg-brand-lavender border-brand-primary/20 text-brand-primary',
      icon: <Info className="w-5 h-5 text-brand-primary shrink-0" />,
    },
  };

  const current = typeConfig[type] || typeConfig.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-200 font-inter"
    >
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${current.bg}`}>
        {current.icon}
        <div className="flex-1 text-sm font-medium">{message}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 -mr-1 rounded-md opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
