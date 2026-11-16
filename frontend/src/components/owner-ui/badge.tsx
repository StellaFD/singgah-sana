import type { HTMLAttributes } from 'react';
import SharedBadge, { type BadgeVariant } from '@/components/ui/Badge';
import { cn } from '@/lib/owner/cn';

export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'brand';

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <SharedBadge tone={tone as BadgeVariant} className={cn('font-semibold', className)} {...props}>
      {children}
    </SharedBadge>
  );
}
