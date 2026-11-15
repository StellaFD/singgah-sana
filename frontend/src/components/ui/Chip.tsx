'use client';

import React from 'react';
import { X } from 'lucide-react';

export interface ChipProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label?: string;
}

export default function Chip({
  children,
  active = false,
  onClick,
  onRemove,
  icon = null,
  className = '',
  disabled = false,
  label,
}: ChipProps) {
  const chipText = label || (typeof children === 'string' ? children : 'item');

  if (onRemove) {
    return (
      <span
        className={`
          inline-flex items-center rounded-full text-xs font-medium font-inter
          transition-all duration-150 select-none border
          ${
            active
              ? 'bg-brand-lavender text-brand-primary border-brand-primary font-semibold'
              : 'bg-white text-ink-muted border-surface-border'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={`
            inline-flex items-center gap-1.5 py-1.5 pl-3 pr-1.5 rounded-l-full
            focus:outline-none focus:ring-2 focus:ring-brand-primary focus:z-10
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:text-ink'}
          `}
          aria-label={onClick ? `Pilih filter ${chipText}` : chipText}
          aria-pressed={active}
        >
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={`
            inline-flex items-center justify-center p-1 mr-1 rounded-full
            hover:bg-brand-primary/10 text-brand-primary transition-colors
            focus:outline-none focus:ring-2 focus:ring-brand-primary focus:z-10
            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          `}
          aria-label={`Hapus filter ${chipText}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-inter
        transition-all duration-150 select-none border focus:outline-none focus:ring-2 focus:ring-brand-primary
        ${
          active
            ? 'bg-brand-lavender text-brand-primary border-brand-primary font-semibold'
            : 'bg-white text-ink-muted border-surface-border hover:border-ink-muted hover:text-ink'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      aria-label={onClick ? `Pilih filter ${chipText}` : chipText}
      aria-pressed={active}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
