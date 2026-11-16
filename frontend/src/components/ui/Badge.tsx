import React from 'react';
import { ShieldCheck, Clock, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

export type BadgeVariant =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'quota'
  | 'quotaFull'
  | 'putra'
  | 'putri'
  | 'campur'
  | 'neutral'
  | 'brand'
  | 'success'
  | 'danger'
  | 'warning';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  tone?: BadgeVariant;
  className?: string;
  size?: BadgeSize;
}

export default function Badge({
  children,
  variant,
  tone,
  className = '',
  size = 'sm',
}: BadgeProps) {
  const activeVariant: BadgeVariant = tone || variant || 'neutral';

  const sizeStyles: Record<BadgeSize, string> = {
    xs: 'text-[11px] px-2 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-2',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    approved: 'bg-status-approvedBg border border-status-approvedBorder text-status-approvedText font-medium',
    pending: 'bg-status-pendingBg border border-status-pendingBorder text-status-pendingText font-medium',
    rejected: 'bg-status-rejectedBg border border-status-rejectedBorder text-status-rejectedText font-medium',
    quota: 'bg-brand-lavender text-brand-primary border border-brand-primary/20 font-semibold',
    quotaFull: 'bg-red-50 text-red-600 border border-red-200 font-semibold',
    putra: 'bg-gender-putraBg text-gender-putraText font-medium border border-blue-200',
    putri: 'bg-gender-putriBg text-gender-putriText font-medium border border-pink-200',
    campur: 'bg-gender-campurBg text-gender-campurText font-medium border border-purple-200',
    neutral: 'bg-surface-muted text-ink-muted border border-surface-border font-medium',
    brand: 'bg-brand-lavender text-brand-primary border border-brand-primary/20 font-semibold',
    success: 'bg-status-approvedBg border border-status-approvedBorder text-status-approvedText font-medium',
    danger: 'bg-status-rejectedBg border border-status-rejectedBorder text-status-rejectedText font-medium',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800 font-medium',
  };

  const renderIcon = () => {
    if (activeVariant === 'approved') return <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    if (activeVariant === 'pending') return <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    if (activeVariant === 'rejected' || activeVariant === 'danger') return <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    if (activeVariant === 'warning') return <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    if (activeVariant === 'success') return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    return null;
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-inter select-none ${sizeStyles[size] || sizeStyles.sm} ${variantStyles[activeVariant] || variantStyles.neutral} ${className}`}
    >
      {renderIcon()}
      <span>{children}</span>
    </span>
  );
}
