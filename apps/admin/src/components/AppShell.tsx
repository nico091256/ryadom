'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronsLeft,
  ChevronsRight,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  ShoppingBag,
  Store,
  TicketPercent,
  Users,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminUser } from '@/lib/types';
import { cn } from '@/lib/format';
import { Spinner } from '@/components/ui';

const NAV = [
  { section: 'Asosiy', items: [{ label: 'Boshqaruv paneli', href: '/', icon: LayoutDashboard }] },
  {
    section: 'Savdo',
    items: [
      { label: 'Buyurtmalar', href: '/orders', icon: ShoppingBag },
      { label: "Do'konlar", href: '/shops', icon: Store },
    ],
  },
  {
    section: 'Katalog',
    items: [
      { label: 'Kategoriyalar', href: '/categories', icon: FolderTree },
      { label: 'Promo-kodlar', href: '/promo-codes', icon: TicketPercent },
    ],
  },
  { section: 'Odamlar', items: [{ label: 'Foydalanuvchilar', href: '/users', icon: Users }] },
  { section: 'Nazorat', items: [{ label: 'Audit jurnali', href: '/audit-log', icon: ScrollText }] },
];

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Boshqaruv paneli';
  if (pathname.startsWith('/orders')) return 'Buyurtmalar';
  if (pathname === '/shops/new') return "Yangi do'kon";
  if (pathname.startsWith('/shops/')) return "Do'kon tafsilotlari";
  if (pathname.startsWith('/shops')) return "Do'konlar";
  if (pathname.startsWith('/users')) return 'Foydalanuvchilar';
  if (pathname.startsWith('/categories')) return 'Kategoriyalar';
  if (pathname.startsWith('/promo-codes')) return 'Promo-kodlar';
  if (pathname.startsWith('/audit-log')) return 'Audit jurnali';
  return 'Ryadom Admin';
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-brand',
        size === 'lg' ? 'h-12 w-12 text-2xl' : 'h-9 w-9 text-lg',
      )}
    >
      R
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLogin = pathname === '/login';

  // Auth guard
  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    if (!api.isAuthenticated()) {
      api.logout();
      setReady(false);
      router.replace('/login');
      return;
    }
    setUser(api.getUser());
    setReady(true);
  }, [isLogin, pathname, router]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('ryadom_sidebar_collapsed') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('ryadom_sidebar_collapsed', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const logout = () => {
    api.logout();
    router.replace('/login');
  };

  if (isLogin) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const title = pageTitle(pathname);
  const initials = (user?.name || user?.login || 'A')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sidebar = (mobile: boolean) => {
    const compact = collapsed && !mobile;
    return (
      <div className="flex h-full flex-col">
        <div className={cn('flex h-16 items-center gap-3 border-b border-slate-200 px-4', compact && 'justify-center px-0')}>
          <Logo />
          {!compact && (
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight tracking-tight text-slate-900">Ryadom</p>
              <p className="text-[11px] leading-tight text-slate-500">Admin panel</p>
            </div>
          )}
          {mobile && (
            <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Yopish">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.section}>
              {!compact ? (
                <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.section}</p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-slate-200" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={compact ? item.label : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        compact && 'justify-center px-0',
                        active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} />
                      {!compact && <span className="truncate">{item.label}</span>}
                      {!compact && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {!mobile && (
          <div className="border-t border-slate-200 p-3">
            <button
              onClick={toggleCollapsed}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                compact && 'justify-center px-0',
              )}
              title={compact ? 'Kengaytirish' : "Yig'ish"}
            >
              {compact ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
              {!compact && <span>Yig'ish</span>}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {sidebar(false)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">{sidebar(true)}</aside>
        </div>
      )}

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Menyu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-900">{user?.name || 'Administrator'}</p>
              <p className="text-xs leading-tight text-slate-500">@{user?.login || 'admin'}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials}
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Chiqish</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
