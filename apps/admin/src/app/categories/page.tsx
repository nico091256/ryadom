'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FolderTree, Plus, Edit2, Save, X, Tag } from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name_uz: '',
    name_ru: '',
    name_en: '',
    icon_url: '',
  });

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateCategory(editingId, formData);
      } else {
        await api.createCategory(formData);
      }
      setIsCreating(false);
      setEditingId(null);
      setFormData({ name_uz: '', name_ru: '', name_en: '', icon_url: '' });
      await loadCategories();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    }
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setIsCreating(false);
    setFormData({
      name_uz: cat.name_uz,
      name_ru: cat.name_ru || '',
      name_en: cat.name_en || '',
      icon_url: cat.icon_url || '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Global Mahsulot Kategoriyalari</h2>
          <p className="text-xs text-slate-500 mt-1">
            Barcha do'konlar foydalanadigan mahsulot toifalari (3 tilda)
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingId(null);
              setFormData({ name_uz: '', name_ru: '', name_en: '', icon_url: '' });
            }}
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-xs"
          >
            <Plus size={16} />
            <span>Yangi kategoriya</span>
          </button>
        )}
      </div>

      {/* Modal / Inline Form for Add & Edit */}
      {(isCreating || editingId) && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-emerald-500/30 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-900">
              {editingId ? 'Kategoriyani Tahrirlash' : 'Yangi Kategoriya Yaratish'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
              }}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomi (O'zbekcha) *</label>
              <input
                type="text"
                required
                value={formData.name_uz}
                onChange={(e) => setFormData({ ...formData, name_uz: e.target.value })}
                placeholder="Non va pishiriqlar"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomi (Ruscha)</label>
              <input
                type="text"
                value={formData.name_ru}
                onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
                placeholder="Хлеб и выпечка"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomi (Inglizcha)</label>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                placeholder="Bakery & Bread"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ikonka yoki Rasm URL</label>
              <input
                type="text"
                value={formData.icon_url}
                onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                placeholder="bread-slice yoki https://..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
              }}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              Saqlash
            </button>
          </div>
        </form>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
        ) : categories.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-400 text-sm">Kategoriyalar mavjud emas.</div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                    <Tag size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{cat.name_uz}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{cat.name_ru} &bull; {cat.name_en}</p>
                  </div>
                </div>
                <button
                  onClick={() => startEdit(cat)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
