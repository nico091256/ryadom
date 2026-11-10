'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, ChevronsLeft, ChevronsRight, KeyRound, LogOut, Menu, Package, ShoppingBag, Store, X } from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket, joinShopRoom, SOCKET_EVENTS } from '@/lib/socket';
import type { Order, StoreUser } from '@/lib/types';
import { cn } from '@/lib/format';
import { Spinner } from '@/components/ui';
import { NewOrderBanner } from '@/components/orders/NewOrderBanner';
import { OrderAlertProvider, useNewOrderAlert } from '@/components/orders/useNewOrderAlert';
import { LanguageSwitcher } from '@/lib/i18n';

const NAV = [
  {
    section: 'Savdo',
    items: [
      { label: 'Buyurtmalar', href: '/', icon: ShoppingBag },
      { label: 'Mahsulotlar', href: '/products', icon: Package },
    ],
  },
  {
    section: "Do'kon",
    items: [
      { label: "Do'kon", href: '/shop', icon: Store },
      { label: 'Statistika', href: '/stats', icon: BarChart3 },
    ],
  },
];

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Buyurtmalar';
  if (pathname.startsWith('/orders')) return 'Buyurtmalar';
  if (pathname.startsWith('/products')) return 'Mahsulotlar';
  if (pathname.startsWith('/shop')) return "Do'kon";
  if (pathname.startsWith('/stats')) return 'Statistika';
  return "Ryadom Do'kon";
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

function GlobalOrderMonitor({ shopId, active }: { shopId: string | null; active: boolean }) {
  const router = useRouter();
  const orderAlert = useNewOrderAlert();
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!active) return;
    const s = getSocket();
    if (shopId) joinShopRoom(shopId);

    const onConnect = () => {
      if (shopId) joinShopRoom(shopId);
    };
    const onNew = (payload: Order | undefined) => {
      if (payload && typeof payload === 'object' && payload.id) {
        seenIdsRef.current?.add(payload.id);
        orderAlert.trigger(payload);
      }
    };

    s.on('connect', onConnect);
    s.on(SOCKET_EVENTS.ORDER_NEW, onNew);
    return () => {
      s.off('connect', onConnect);
      s.off(SOCKET_EVENTS.ORDER_NEW, onNew);
    };
  }, [active, shopId, orderAlert]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.getOrders({ status: 'new', limit: 20 });
        if (cancelled) return;
        const list = res.data || [];
        if (seenIdsRef.current) {
          list
            .filter((o) => o.status === 'new' && !seenIdsRef.current!.has(o.id))
            .forEach((o) => orderAlert.trigger(o));
        }
        seenIdsRef.current = new Set(list.map((o) => o.id));
      } catch {
        /* ignore background poll errors */
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, orderAlert]);

  if (!active || orderAlert.pending.length === 0) return null;

  return (
    <NewOrderBanner
      pending={orderAlert.pending}
      onClick={() => {
        orderAlert.acknowledge();
        router.push('/');
      }}
    />
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OrderAlertProvider>
      <AppShellInner>{children}</AppShellInner>
    </OrderAlertProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [user, setUser] = useState<StoreUser | null>(null);
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isBare = pathname === '/login' || pathname === '/change-password';

  // Auth guard
  useEffect(() => {
    if (isBare) {
      setReady(true);
      return;
    }
    if (!api.isAuthenticated()) {
      setReady(false);
      void api.logout();
      router.replace('/login');
      return;
    }
    const u = api.getUser();
    if (u?.must_change_password) {
      setReady(false);
      router.replace('/change-password');
      return;
    }
    setUser(u);
    setReady(true);
  }, [isBare, pathname, router]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('ryadom_store_sidebar_collapsed') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('ryadom_store_sidebar_collapsed', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const logout = async () => {
    await api.logout();
    router.replace('/login');
  };

  if (isBare) {
    return (
      <>
        <div className="fixed right-4 top-4 z-50">
          <LanguageSwitcher />
        </div>
        {children}
      </>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const title = pageTitle(pathname);
  const initials = (user?.name || user?.login || 'D')
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
              <p className="text-[11px] leading-tight text-slate-500">Do'kon paneli</p>
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

      <div className={cn('flex min-h-screen min-w-0 flex-col overflow-x-hidden transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:h-16 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Menyu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-900">{user?.name || "Do'konchi"}</p>
              <p className="text-xs leading-tight text-slate-500">@{user?.login || 'seller'}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 sm:h-9 sm:w-9 sm:text-sm">
              {initials}
            </div>
            <Link
              href="/change-password"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-2.5 sm:py-2"
              title="Parolni o'zgartirish"
            >
              <KeyRound className="h-4 w-4" />
              <span className="hidden xl:inline">Parol</span>
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 sm:px-2.5 sm:py-2"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Chiqish</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3.5 pb-24 pt-4 sm:px-6 sm:py-6 lg:px-8 lg:pb-8">
          <GlobalOrderMonitor shopId={user?.shopId ?? null} active={pathname !== '/'} />
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav
          aria-label="Mobil navigatsiya"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-1 py-1 backdrop-blur lg:hidden"
        >
          {NAV.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors',
                  active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-900',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-11 items-center justify-center rounded-full transition-colors',
                    active && 'bg-brand-50 text-brand-600',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
