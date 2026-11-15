'use client';

import React from 'react';

export interface ToggleProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  description?: string;
  className?: string;
}

export default function Toggle({
  label,
  checked = false,
  onChange,
  id,
  disabled = false,
  description,
  className = '',
}: ToggleProps) {
  const toggleId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex items-center justify-between gap-3 font-inter ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {(label || description) && (
        <label htmlFor={toggleId} className="cursor-pointer select-none">
          {label && <span className="text-sm font-medium text-ink block">{label}</span>}
          {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
        </label>
      )}
      <button
        type="button"
        id={toggleId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
          checked ? 'bg-brand-primary' : 'bg-surface-border'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
