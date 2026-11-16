import React from 'react';

export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TableContainer({ children, className = '', ...props }: TableContainerProps) {
  return (
    <div
      className={`w-full overflow-x-auto rounded-xl border border-surface-border bg-white shadow-xs font-inter ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Table({ children, className = '', ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full text-left text-sm text-ink ${className}`} {...props}>
      {children}
    </table>
  );
}

export function TableHead({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-b border-surface-border bg-surface-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted select-none ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-surface-border/60 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`transition-colors hover:bg-surface-subtle/50 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({ children, className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3.5 font-semibold ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3.5 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
