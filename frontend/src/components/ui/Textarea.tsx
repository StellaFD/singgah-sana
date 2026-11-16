'use client';

import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    error,
    helperText,
    id,
    className = '',
    disabled = false,
    required = false,
    rows = 4,
    ...props
  },
  ref
) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full font-inter">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-ink mb-1.5"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          className={`
            block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink placeholder-ink-light
            transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary
            focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:border-brand-primary
            disabled:bg-surface-muted disabled:text-ink-muted disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-surface-border'}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="mt-1.5 text-xs text-ink-muted">{helperText}</p>
      )}
    </div>
  );
});

export default Textarea;
