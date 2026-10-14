'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Users, Search, Shield, UserX, CheckCircle, Smartphone, Lock } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers(search || undefined, selectedRole || undefined);
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [selectedRole]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleToggleBlock = async (user: any) => {
    setUpdatingId(user.id);
    try {
      await api.toggleBlockUser(user.id, !user.is_blocked);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Foydalanuvchilar Boshqaruvi</h2>
        <p className="text-xs text-slate-500 mt-1">Platformadagi mijozlar va do'konchilar akkauntlari nazorati</p>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, telefon yoki login orqali qidirish..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
          />
        </form>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white w-full sm:w-auto"
        >
          <option value="">Barcha rollar</option>
          <option value="customer">Mijozlar (Customer)</option>
          <option value="seller">Sotuvchilar (Seller)</option>
          <option value="admin">Administratorlar (Admin)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Foydalanuvchilar topilmadi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-200 uppercase text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Foydalanuvchi</th>
                  <th className="px-5 py-3.5">Roli</th>
                  <th className="px-5 py-3.5">Aloqa</th>
                  <th className="px-5 py-3.5">Holati</th>
                  <th className="px-5 py-3.5 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 text-sm">{user.name || 'Nomsiz'}</div>
                      <div className="text-[11px] text-slate-400">
                        {user.login ? `@${user.login}` : user.phone}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                          user.role === 'admin'
                            ? 'bg-purple-50 text-purple-700'
                            : user.role === 'seller'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-slate-600">
                      {user.phone || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          user.is_blocked
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {user.is_blocked ? 'Bloklangan' : 'Faol'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleToggleBlock(user)}
                          disabled={updatingId === user.id}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                            user.is_blocked
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                          }`}
                        >
                          {user.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}
                        </button>
                      )}
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
