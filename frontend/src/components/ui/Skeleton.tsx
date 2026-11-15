import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-border/60 rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}
