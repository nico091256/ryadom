'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, Store, User, Lock, Phone, MapPin, Clock } from 'lucide-react';

export default function NewShopPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '+99890',
    address_text: '',
    lat: 41.2995, // Tashkent center
    lng: 69.2401,
    open_time: '08:00',
    close_time: '23:00',
    seller_name: '',
    seller_login: '',
    seller_password: 'ShopkeeperPass123!',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.createShop(formData);
      router.push('/shops');
    } catch (err: any) {
      setError(err.message || 'Do\'kon qo\'shishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Link
          href="/shops"
          className="p-2 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-xl transition-colors shadow-xs"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Yangi Do'kon Qo'shish</h2>
          <p className="text-xs text-slate-500 mt-0.5">Do'kon va uning sotuvchi akkauntini yaratish</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Shop Info Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm pb-2 border-b border-slate-100">
            <Store size={18} className="text-emerald-600" />
            <span>Do'kon Ma'lumotlari</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Do'kon Nomi *</label>
              <input
                type="text"
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Masalan: Yunusobod Oziq-Ovqat"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon Raqami *</label>
              <input
                type="text"
                required
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+998901234567"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shahar</label>
              <input
                type="text"
                disabled
                value="Toshkent shahri"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Aniq Manzili *</label>
              <input
                type="text"
                required
                name="address_text"
                value={formData.address_text}
                onChange={handleChange}
                placeholder="Masalan: Toshkent sh., Yunusobod 4-mavze, 15-uy"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ochilish Vaqti</label>
              <input
                type="text"
                name="open_time"
                value={formData.open_time}
                onChange={handleChange}
                placeholder="08:00"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Yopilish Vaqti</label>
              <input
                type="text"
                name="close_time"
                value={formData.close_time}
                onChange={handleChange}
                placeholder="23:00"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Location & GPS Coordinates (Yandex map compatible) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm pb-2 border-b border-slate-100">
            <MapPin size={18} className="text-emerald-600" />
            <span>Yandex Xaritasi Geografik Koordinatalari</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kenglik (Latitude) *</label>
              <input
                type="number"
                step="0.000001"
                required
                name="lat"
                value={formData.lat}
                onChange={handleChange}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Uzunlik (Longitude) *</label>
              <input
                type="number"
                step="0.000001"
                required
                name="lng"
                value={formData.lng}
                onChange={handleChange}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 font-mono"
              />
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-slate-500 text-[11px]">
            💡 Standart Toshkent koordinatalari kiritilgan. Xaridorlar ushbu nuqtadan 3 km radius ichida do'konni ko'radilar.
          </div>
        </div>

        {/* Seller Account Credentials */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm pb-2 border-b border-slate-100">
            <User size={18} className="text-emerald-600" />
            <span>Sotuvchi Akkaunti Ma'lumotlari (Shopkeeper)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sotuvchi Ism-Familiyasi</label>
              <input
                type="text"
                name="seller_name"
                value={formData.seller_name}
                onChange={handleChange}
                placeholder="Masalan: Jamshid Karimov"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Login (Foydalanuvchi nomi) *</label>
              <input
                type="text"
                required
                name="seller_login"
                value={formData.seller_login}
                onChange={handleChange}
                placeholder="seller_yunusobod"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Boshlang'ich Parol *</label>
              <input
                type="text"
                required
                name="seller_password"
                value={formData.seller_password}
                onChange={handleChange}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 font-mono"
              />
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-800 text-[11px]">
            ⚠️ Texnik topshiriq talabi: Ushbu login va parolni sotuvchiga topshirasiz. Sotuvchi dasturga birinchi marta kirganda parolini o'zgartirishi majburiy bo'ladi.
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-3 pt-2">
          <Link
            href="/shops"
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            Bekor qilish
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
          >
            {loading ? 'Saqlanmoqda...' : 'Do\'konni Ro\'yxatdan O\'tkazish'}
          </button>
        </div>
      </form>
    </div>
  );
}
