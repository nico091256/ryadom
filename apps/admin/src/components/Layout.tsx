'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  FolderTree,
  ShoppingBag,
  Users,
  LogOut,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import { api, AdminUser } from '@/lib/api';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const currentUser = api.getUser();
    if (!currentUser && pathname !== '/login') {
      router.push('/login');
    } else {
      setUser(currentUser);
    }
  }, [pathname, router]);

  const handleLogout = () => {
    api.removeToken();
    router.push('/login');
  };

  if (pathname === '/login') {
    return <>{children}</>;
  }

  const navItems = [
    { label: 'Boshqaruv paneli', href: '/', icon: LayoutDashboard },
    { label: "Do'konlar", href: '/shops', icon: Store },
    { label: 'Kategoriyalar', href: '/categories', icon: FolderTree },
    { label: 'Buyurtmalar', href: '/orders', icon: ShoppingBag },
    { label: 'Foydalanuvchilar', href: '/users', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
            L
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">LocalShop Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col z-40 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
            L
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-wide">LocalShop</h1>
            <p className="text-xs text-slate-400">Admin Platform</p>
          </div>
        </div>

        {/* Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Admin User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'Administrator'}</p>
              <p className="text-xs text-slate-400 truncate">@{user?.login || 'admin'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Chiqish"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="bg-white border-b border-slate-200 px-6 py-4 hidden md:flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Toshkent Bozori Boshqaruvi</h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Jonli Server Aloqada
            </span>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}
