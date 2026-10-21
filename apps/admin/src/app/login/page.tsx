'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';
import { Logo } from '@/components/AppShell';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (api.isAuthenticated()) router.replace('/');
    else if (params?.get('expired')) setError('Sessiya muddati tugadi. Iltimos, qaytadan kiring.');
  }, [router, params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError('Login va parolni kiriting.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.login(login.trim(), password);
      router.replace('/');
    } catch (err) {
      const msg = errorMessage(err);
      setError(/invalid|incorrect|credential|unauthor|password/i.test(msg) ? "Login yoki parol noto'g'ri." : msg);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-700 lg:block">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-accent-500/25 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl font-bold text-brand-700">R</div>
            <span className="text-xl font-bold tracking-tight">Ryadom</span>
          </div>
          <div>
            <h2 className="max-w-md text-3xl font-semibold leading-tight">Mahalladagi do'konlar — bir necha daqiqada eshigingizda.</h2>
            <p className="mt-4 max-w-md text-brand-100">
              Buyurtmalar, do'konlar, foydalanuvchilar va promo-kodlarni bitta joydan boshqaring.
            </p>
          </div>
          <p className="text-sm text-brand-200">© {new Date().getFullYear()} Ryadom · Toshkent</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6 lg:bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="lg:hidden">
              <Logo size="lg" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 lg:mt-0">Admin panelga kirish</h1>
            <p className="mt-1 text-sm text-slate-500">Administrator hisobingiz ma'lumotlarini kiriting</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Login" htmlFor="login">
              <Input
                id="login"
                autoComplete="username"
                autoFocus
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="admin"
                leftIcon={<User className="h-4 w-4" />}
                className="h-10"
              />
            </Field>
            <Field label="Parol" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  aria-label={show ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" size="lg" loading={loading} className="w-full">
              {loading ? 'Kirilmoqda...' : 'Kirish'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
