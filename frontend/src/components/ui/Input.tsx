'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    id,
    className = '',
    disabled = false,
    required = false,
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const describedBy = error
    ? inputId ? `${inputId}-error` : undefined
    : helperText
    ? inputId ? `${inputId}-helper` : undefined
    : undefined;

  return (
    <div className="w-full font-inter">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-ink mb-1.5"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative rounded-xl shadow-sm">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`
            block w-full h-12 rounded-xl border bg-white px-3.5 text-sm text-ink placeholder-ink-light
            transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary
            focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:border-brand-primary
            disabled:bg-surface-muted disabled:text-ink-muted disabled:cursor-not-allowed
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500 focus-visible:ring-red-500' : 'border-surface-border'}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-muted">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p id={inputId ? `${inputId}-error` : undefined} className="mt-1.5 text-xs text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={inputId ? `${inputId}-helper` : undefined} className="mt-1.5 text-xs text-ink-muted">{helperText}</p>
      )}
    </div>
  );
});

export default Input;
