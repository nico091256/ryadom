import React from 'react';
import { cn } from '@/lib/format';
import { ORDER_STATUS_META } from '@/lib/constants';
import type { OrderStatus } from '@/lib/types';

export type Tone = 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'violet';

const tones: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

const dots: Record<Tone, string> = {
  gray: 'bg-slate-400',
  green: 'bg-green-500',
  red: 'bg-rose-500',
  amber: 'bg-amber-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
};

export function Badge({
  tone = 'gray',
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, badge: tones.gray, dot: 'bg-slate-400' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        meta.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}
