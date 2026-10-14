'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Store, Plus, MapPin, Phone, CheckCircle, XCircle, Search } from 'lucide-react';

export default function ShopsPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadShops = async () => {
    try {
      const data = await api.getShops();
      setShops(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  const handleToggleActive = async (shop: any) => {
    setUpdatingId(shop.id);
    try {
      await api.updateShop(shop.id, { is_active: !shop.is_active });
      await loadShops();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredShops = shops.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.owner?.login?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Do'konlar Ro'yxati</h2>
          <p className="text-xs text-slate-500 mt-1">Platformada ro'yxatdan o'tgan mahalla do'konlari</p>
        </div>
        <Link
          href="/shops/new"
          className="inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-xs"
        >
          <Plus size={16} />
          <span>Yangi do'kon qo'shish</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search size={18} />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Do'kon nomi, login yoki telefon orqali qidirish..."
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
        ) : filteredShops.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Do'konlar topilmadi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-200 uppercase text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Do'kon</th>
                  <th className="px-5 py-3.5">Sotuvchi Akkaunti</th>
                  <th className="px-5 py-3.5">Ish Vaqti</th>
                  <th className="px-5 py-3.5">Mahsulotlar</th>
                  <th className="px-5 py-3.5">Holati</th>
                  <th className="px-5 py-3.5 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShops.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 font-bold overflow-hidden border border-slate-200">
                          {shop.logo_url ? (
                            <img src={shop.logo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            shop.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{shop.name}</div>
                          <div className="flex items-center space-x-1 text-slate-400 text-[11px] mt-0.5">
                            <MapPin size={12} />
                            <span className="truncate max-w-[200px]">{shop.address_text}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">@{shop.owner?.login}</div>
                      <div className="text-slate-400 text-[11px]">{shop.phone}</div>
                    </td>
                    <td className="px-5 py-4 font-mono">
                      {shop.open_time} — {shop.close_time}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {shop._count?.products || 0} ta mahsulot
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            shop.is_active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {shop.is_active ? 'Faol' : 'Bloklangan'}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            shop.is_open
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {shop.is_open ? 'Ochiq' : 'Yopiq'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleToggleActive(shop)}
                        disabled={updatingId === shop.id}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          shop.is_active
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {shop.is_active ? 'Bloklash' : 'Faollashtirish'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
