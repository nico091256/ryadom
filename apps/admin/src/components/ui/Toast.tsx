'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/format';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = ++idRef.current;
      setItems((xs) => [...xs.slice(-3), { id, kind, title, description }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  const value = useMemo<ToastApi>(
    () => ({
      success: (t, d) => push('success', t, d),
      error: (t, d) => push('error', t, d),
      info: (t, d) => push('info', t, d),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:items-end">
        {items.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info;
          return (
            <div
              key={t.id}
              role="status"
              className="animate-pop-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
            >
              <Icon
                className={cn(
                  'mt-0.5 h-5 w-5 shrink-0',
                  t.kind === 'success' ? 'text-brand-600' : t.kind === 'error' ? 'text-rose-500' : 'text-sky-500',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{t.title}</p>
                {t.description && <p className="mt-0.5 break-words text-sm text-slate-500">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Yopish">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
