'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'options'> {
  label?: string;
  options: Array<SelectOption | string>;
  error?: string;
  helperText?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    options = [],
    value,
    onChange,
    error,
    helperText,
    id,
    className = '',
    disabled = false,
    required = false,
    ...props
  },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const describedBy = error
    ? selectId ? `${selectId}-error` : undefined
    : helperText
    ? selectId ? `${selectId}-helper` : undefined
    : undefined;

  return (
    <div className="w-full font-inter">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-ink mb-1.5"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`
            block w-full appearance-none rounded-lg border bg-white px-3.5 py-2.5 pr-10 text-sm text-ink
            transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary
            focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:border-brand-primary
            disabled:bg-surface-muted disabled:text-ink-muted disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500 focus-visible:ring-red-500' : 'border-surface-border'}
            ${className}
          `}
          {...props}
        >
          {options.map((opt, idx) => {
            const isObj = typeof opt === 'object' && opt !== null;
            const optVal = isObj ? opt.value : opt;
            const optLabel = isObj ? opt.label : opt;
            return (
              <option key={idx} value={optVal}>
                {optLabel}
              </option>
            );
          })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-muted">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error && (
        <p id={selectId ? `${selectId}-error` : undefined} className="mt-1.5 text-xs text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={selectId ? `${selectId}-helper` : undefined} className="mt-1.5 text-xs text-ink-muted">{helperText}</p>
      )}
    </div>
  );
});

export default Select;
