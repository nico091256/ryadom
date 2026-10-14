'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ShoppingBag,
  Store,
  Users,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.getDashboardStats();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Statistikani yuklashda xatolik yuz berdi.');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
        {error}
      </div>
    );
  }

  const summary = stats?.summary || {
    totalOrders: 0,
    totalShops: 0,
    totalCustomers: 0,
    totalSellers: 0,
    needsAttentionCount: 0,
  };

  const chartData: any[] = stats?.ordersPerDayLast30Days || [];
  const maxDayOrders = Math.max(...chartData.map((d) => d.orderCount), 5);

  return (
    <div className="space-y-6">
      {/* Needs Attention Alert Banner */}
      {summary.needsAttentionCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-amber-800">
            <AlertTriangle className="text-amber-500 shrink-0" size={24} />
            <div>
              <p className="font-semibold text-sm">
                Diqqat talab buyurtmalar mavjud: {summary.needsAttentionCount} ta
              </p>
              <p className="text-xs text-amber-700">
                Ushbu buyurtmalar 5 daqiqadan ko'proq vaqt davomida do'kon tomonidan qabul qilinmagan.
              </p>
            </div>
          </div>
          <Link
            href="/orders?status=new"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center space-x-1"
          >
            <span>Ko'rib chiqish</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Jami Buyurtmalar</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{summary.totalOrders}</span>
            <span className="text-xs text-emerald-600 font-medium">Barcha buyurtmalar</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Faol Do'konlar</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Store size={20} />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{summary.totalShops}</span>
            <span className="text-xs text-slate-500 font-medium">Toshkent shahrida</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Mijozlar</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Users size={20} />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{summary.totalCustomers}</span>
            <span className="text-xs text-purple-600 font-medium">Faol xaridorlar</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Kechikkanlar (5 min+)</span>
            <div className={`p-2 rounded-xl ${summary.needsAttentionCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              <Clock size={20} />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-2xl font-bold ${summary.needsAttentionCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {summary.needsAttentionCount}
            </span>
            <span className="text-xs text-slate-500">Kechikkan buyurtma</span>
          </div>
        </div>
      </div>

      {/* 30-Day Orders Chart Visualizer */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">So'nggi 30 kunlik buyurtmalar faolligi</h3>
            <p className="text-xs text-slate-500 mt-0.5">Kunlik qabul qilingan buyurtmalar soni</p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <span className="w-3 h-3 bg-emerald-500 rounded-xs inline-block"></span>
            <span>Buyurtmalar grafigi</span>
          </div>
        </div>

        {/* Bar chart container */}
        <div className="h-48 flex items-end space-x-1 sm:space-x-1.5 pt-6 border-b border-slate-100">
          {chartData.map((d, index) => {
            const heightPercent = Math.max(8, (d.orderCount / maxDayOrders) * 100);
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center group relative h-full justify-end"
              >
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[11px] px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-20">
                  {d.date}: {d.orderCount} buyurtma
                </div>
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-sm transition-all duration-200 ${
                    d.orderCount > 0
                      ? 'bg-emerald-500 group-hover:bg-emerald-600'
                      : 'bg-slate-100 group-hover:bg-slate-200'
                  }`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 mt-2 font-mono">
          <span>{chartData[0]?.date || ''}</span>
          <span>{chartData[Math.floor(chartData.length / 2)]?.date || ''}</span>
          <span>{chartData[chartData.length - 1]?.date || ''}</span>
        </div>
      </div>

      {/* Quick Launch Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white flex flex-col justify-between shadow-sm">
          <div>
            <h4 className="font-bold text-lg mb-1">Yangi Do'kon Qo'shish</h4>
            <p className="text-emerald-100 text-xs">
              Platformaga yangi mahalla do'koni va uning sotuvchi akkauntini Yandex xaritasida manzilini belgilab biriktiring.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/shops/new"
              className="inline-flex items-center space-x-2 bg-white text-emerald-800 font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors shadow-xs"
            >
              <span>Do'kon ro'yxatdan o'tkazish</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-lg text-slate-900 mb-1">Global Kategoriyalar Boshqaruvi</h4>
            <p className="text-slate-500 text-xs">
              Do'konlar o'z mahsulotlarini kiritishlari uchun 3 tilda (UZ, RU, EN) global toifalar va ikonkalarni boshqaring.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/categories"
              className="inline-flex items-center space-x-2 bg-slate-900 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors shadow-xs"
            >
              <span>Kategoriyalarga o'tish</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
