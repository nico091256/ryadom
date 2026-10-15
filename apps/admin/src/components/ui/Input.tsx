'use client';

import React from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/format';

const fieldBase =
  'block w-full rounded-lg border-0 bg-white text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

const invalidRing = 'ring-rose-400 focus:ring-rose-500';

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
  htmlFor,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leftIcon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leftIcon, rightAddon, ...props },
  ref,
) {
  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">{leftIcon}</span>
      )}
      <input
        ref={ref}
        className={cn(fieldBase, 'h-9 px-3', leftIcon && 'pl-9', rightAddon && 'pr-14', invalid && invalidRing, className)}
        {...props}
      />
      {rightAddon && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-500">
          {rightAddon}
        </span>
      )}
    </div>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-[88px] px-3 py-2', invalid && invalidRing, className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(fieldBase, 'h-9 appearance-none pl-3 pr-9', invalid && invalidRing, className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
});

export function SearchInput({
  value,
  onChange,
  placeholder = 'Qidirish...',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldBase, 'h-9 pl-9 pr-8')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
          aria-label="Tozalash"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
