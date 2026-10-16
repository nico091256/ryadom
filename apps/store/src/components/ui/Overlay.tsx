'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/format';
import { Button } from './Button';
import { Field, Textarea } from './Input';

// Stack of open overlays so Escape only closes the top-most one.
const stack: number[] = [];
let nextId = 0;

function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const id = ++nextId;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) document.body.style.overflow = '';
    };
  }, [open]);
  return mounted;
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof sizes;
}) {
  const mounted = useOverlay(open, onClose);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          'animate-pop-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          sizes[size],
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <button onClick={onClose} className="-m-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Yopish">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const mounted = useOverlay(open, onClose);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[55] flex justify-end" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className={cn('animate-slide-in relative flex h-full w-full flex-col bg-white shadow-2xl', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
            {description && <div className="mt-0.5 text-sm text-slate-500">{description}</div>}
          </div>
          <button onClick={onClose} className="-m-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Tasdiqlash',
  cancelLabel = 'Bekor',
  tone = 'danger',
  loading,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives the textarea value when `reason` is configured. */
  onConfirm: (reason: string) => void | Promise<void>;
  title: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  reason?: { label: string; placeholder?: string; required?: boolean; minLength?: number };
}) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setText('');
      setTouched(false);
    }
  }, [open]);

  const min = reason?.minLength ?? (reason?.required ? 3 : 0);
  const invalid = !!reason && text.trim().length < min;

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    onConfirm(text.trim());
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={submit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            tone === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-brand-100 text-brand-700',
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {message && <div className="mt-1 text-sm text-slate-600">{message}</div>}
          </div>
          {reason && (
            <Field
              label={reason.label}
              required={reason.required}
              error={touched && invalid ? `Kamida ${min} ta belgi kiriting` : null}
            >
              <Textarea
                autoFocus
                value={text}
                invalid={touched && invalid}
                onChange={(e) => setText(e.target.value)}
                placeholder={reason.placeholder}
                maxLength={500}
              />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}
