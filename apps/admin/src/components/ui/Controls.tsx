'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/format';
import { Skeleton } from './Feedback';

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  size = 'md',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
        checked ? 'bg-brand-600' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white shadow transition-transform',
          size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
          checked ? (size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        copied ? 'bg-brand-50 text-brand-700' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Nusxalandi' : 'Nusxa'}
    </button>
  );
}

export function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate font-mono text-sm font-semibold text-slate-900">{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number | null;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('-mb-px flex gap-1 overflow-x-auto', className)} role="tablist">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            {it.label}
            {it.count != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600',
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'green',
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'green' | 'blue' | 'amber' | 'violet' | 'rose' | 'slate';
  loading?: boolean;
}) {
  const tones = {
    green: 'bg-brand-50 text-brand-700',
    blue: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>{icon}</div>}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-7 w-28" />
          <Skeleton className="mt-2 h-3.5 w-36" />
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </>
      )}
    </div>
  );
}

export function DescList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((it) => (
        <div key={it.label} className="flex items-start justify-between gap-4 py-2 text-sm">
          <dt className="shrink-0 text-slate-500">{it.label}</dt>
          <dd className="min-w-0 text-right font-medium text-slate-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
