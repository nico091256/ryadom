'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button, Field, Input, useToast } from '@/components/ui';
import { Logo } from '@/components/AppShell';

const MIN_LENGTH = 6;

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forced, setForced] = useState(false);

  // This page renders without the shell, so it guards itself.
  useEffect(() => {
    if (!api.isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setForced(!!api.getUser()?.must_change_password);
  }, [router]);

  const nextError = touched && next.length > 0 && next.length < MIN_LENGTH ? `Yangi parol kamida ${MIN_LENGTH} ta belgidan iborat bo'lishi kerak` : null;
  const confirmError = touched && confirm.length > 0 && confirm !== next ? 'Parollar mos kelmadi' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!current || !next || !confirm) {
      setError("Barcha maydonlarni to'ldiring.");
      return;
    }
    if (next.length < MIN_LENGTH) {
      setError(`Yangi parol kamida ${MIN_LENGTH} ta belgidan iborat bo'lishi kerak.`);
      return;
    }
    if (next !== confirm) {
      setError('Yangi parol va tasdiqlash mos kelmadi.');
      return;
    }
    if (next === current) {
      setError('Yangi parol joriy paroldan farq qilishi kerak.');
      return;
    }
    setLoading(true);
    try {
      await api.changePassword(current, next);
      toast.success("Parol o'zgartirildi", 'Endi yangi parol bilan kirasiz.');
      router.replace('/');
    } catch (err) {
      const msg = errorMessage(err);
      setError(/current|invalid|incorrect|wrong|unauthor/i.test(msg) ? "Joriy parol noto'g'ri." : msg);
      setLoading(false);
    }
  };

  const logout = async () => {
    await api.logout();
    router.replace('/login');
  };

  const eye = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
      aria-label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"}
      tabIndex={-1}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Parolni o'zgartirish</h1>
          <p className="mt-1 text-sm text-slate-500">
            {forced
              ? "Xavfsizlik uchun administrator bergan vaqtinchalik parolni o'zgartiring."
              : 'Hisobingiz uchun yangi parol kiriting.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {forced && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Panelga kirishdan oldin parolni yangilash shart.</span>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Joriy parol" htmlFor="current" required>
              <div className="relative">
                <Input
                  id="current"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  className="h-10 pr-10"
                />
                {eye}
              </div>
            </Field>
            <Field label="Yangi parol" htmlFor="next" required error={nextError} hint={!nextError ? `Kamida ${MIN_LENGTH} ta belgi` : undefined}>
              <Input
                id="next"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="••••••••"
                leftIcon={<KeyRound className="h-4 w-4" />}
                invalid={!!nextError}
                className="h-10"
              />
            </Field>
            <Field label="Yangi parolni tasdiqlang" htmlFor="confirm" required error={confirmError}>
              <Input
                id="confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                leftIcon={<KeyRound className="h-4 w-4" />}
                invalid={!!confirmError}
                className="h-10"
              />
            </Field>
            <Button type="submit" size="lg" loading={loading} className="w-full">
              {loading ? 'Saqlanmoqda...' : 'Parolni saqlash'}
            </Button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <button type="button" onClick={logout} className="text-sm text-slate-500 hover:text-slate-700">
            Boshqa hisob bilan kirish
          </button>
        </div>
      </div>
    </div>
  );
}
