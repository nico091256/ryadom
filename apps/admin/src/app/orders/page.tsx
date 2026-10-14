'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  AlertTriangle,
  Search,
  Filter,
} from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');

  const loadOrders = async () => {
    try {
      const res = await api.getOrders({
        status: selectedStatus || undefined,
        paymentMethod: selectedPayment || undefined,
        limit: 50,
      });
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000); // 10s auto-refresh for live tracking
    return () => clearInterval(interval);
  }, [selectedStatus, selectedPayment]);

  const formatPrice = (tiyin: number) => {
    const uzs = Math.floor(tiyin / 100);
    return `${uzs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
  };

  const getStatusBadge = (status: string, needsAttention: boolean) => {
    if (needsAttention && status === 'new') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse border border-amber-300">
          <AlertTriangle size={12} />
          <span>DIQQAT (5 min+)</span>
        </span>
      );
    }

    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
            <Clock size={12} />
            <span>Yangi</span>
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700">
            <CheckCircle size={12} />
            <span>Qabul qilindi</span>
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
            <Package size={12} />
            <span>Tayyorlanmoqda</span>
          </span>
        );
      case 'on_the_way':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700">
            <Truck size={12} />
            <span>Yetkazilmoqda</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
            <CheckCircle size={12} />
            <span>Yetkazildi</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700">
            <XCircle size={12} />
            <span>Bekor qilindi</span>
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Buyurtmalar Nazorati</h2>
          <p className="text-xs text-slate-500 mt-1">Platformadagi barcha joriy va arxiv buyurtmalar monitoringi</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium">
          <Filter size={16} />
          <span>Filtrlar:</span>
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          <option value="">Barcha holatlar</option>
          <option value="new">Yangi (New)</option>
          <option value="accepted">Qabul qilingan (Accepted)</option>
          <option value="preparing">Tayyorlanmoqda (Preparing)</option>
          <option value="on_the_way">Yetkazilmoqda (On the way)</option>
          <option value="delivered">Yetkazilgan (Delivered)</option>
          <option value="cancelled">Bekor qilingan (Cancelled)</option>
        </select>

        <select
          value={selectedPayment}
          onChange={(e) => setSelectedPayment(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          <option value="">To'lov turi: Barchasi</option>
          <option value="cash">Naqd (Yetkazilganda)</option>
          <option value="online">Onlayn (Payme/Click)</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Buyurtmalar topilmadi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-200 uppercase text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">ID / Sana</th>
                  <th className="px-5 py-3.5">Do'kon</th>
                  <th className="px-5 py-3.5">Mijoz / Manzil</th>
                  <th className="px-5 py-3.5">Mahsulotlar</th>
                  <th className="px-5 py-3.5">Summa</th>
                  <th className="px-5 py-3.5">Holati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-slate-50/50 transition-colors ${
                      order.needs_attention && order.status === 'new' ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="px-5 py-4 font-mono">
                      <div className="font-bold text-slate-900 text-xs">#{order.id.slice(0, 8)}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(order.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{order.shop?.name}</div>
                      <div className="text-[11px] text-slate-400">{order.shop?.phone}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{order.customer?.name || 'Mijoz'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{order.customer_phone}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                        {order.address_snapshot?.text}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="text-[11px] text-slate-700">
                            &bull; {item.product_name} <span className="text-slate-400">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 text-sm">{formatPrice(order.total_amount)}</div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {order.payment_method === 'cash' ? 'Naqd' : 'Onlayn'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(order.status, order.needs_attention)}
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
