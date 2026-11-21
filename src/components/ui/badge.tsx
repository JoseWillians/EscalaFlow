import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'info' | 'beginner' | 'ok' | 'warn' | 'danger';

const BADGE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  beginner: 'border-amber-300 bg-amber-50 text-amber-900',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        BADGE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
