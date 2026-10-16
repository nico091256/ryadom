'use client';

import { BellRing, X } from 'lucide-react';
import type { PendingAlert } from './useNewOrderAlert';

export function NewOrderBanner({ pending, onClick }: { pending: PendingAlert[]; onClick: () => void }) {
  if (pending.length === 0) return null;
  const latest = pending[0];
  const extra = pending.length - 1;
  return (
    <div className="sticky top-[4.5rem] z-10 mb-4">
      <button
        type="button"
        onClick={onClick}
        className="animate-pop-in flex w-full items-center gap-3 rounded-xl bg-rose-600 px-4 py-3 text-left text-white shadow-lg shadow-rose-600/30 ring-1 ring-rose-700 transition-colors hover:bg-rose-700"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <BellRing className="h-5 w-5 animate-pulse" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight sm:text-base">
            Yangi buyurtma! {latest.label}
            {extra > 0 && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">+{extra}</span>}
          </span>
          <span className="block text-xs text-rose-100">Ovozni to&apos;xtatish uchun bosing</span>
        </span>
        <X className="h-5 w-5 shrink-0 text-rose-100" />
      </button>
    </div>
  );
}
