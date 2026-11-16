import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export default function Card({
  children,
  className = '',
  hoverable = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-card border border-surface-border overflow-hidden font-inter transition-all duration-200
        ${hoverable ? 'hover:shadow-card-hover hover:border-brand-primary/30 cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
