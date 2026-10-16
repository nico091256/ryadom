import type { OrderStatus, PaymentMethod, PaymentStatus, ShopStatus, UserRole } from './types';

export const ORDER_STATUSES: OrderStatus[] = ['new', 'accepted', 'on_the_way', 'delivered', 'cancelled'];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; badge: string; dot: string; bar: string }> = {
  new: { label: 'Yangi', badge: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500', bar: '#0ea5e9' },
  accepted: { label: 'Qabul qilindi', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', dot: 'bg-indigo-500', bar: '#6366f1' },
  on_the_way: { label: "Yo'lda", badge: 'bg-violet-50 text-violet-700 ring-violet-600/20', dot: 'bg-violet-500', bar: '#8b5cf6' },
  delivered: { label: 'Yetkazildi', badge: 'bg-green-50 text-green-700 ring-green-600/20', dot: 'bg-green-500', bar: '#16a34a' },
  cancelled: { label: 'Bekor qilindi', badge: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500', bar: '#f43f5e' },
};

export const SHOP_STATUS_META: Record<ShopStatus, { label: string; tone: 'gray' | 'green' | 'amber' | 'red' }> = {
  pending: { label: 'Tasdiqlash kutilmoqda', tone: 'amber' },
  active: { label: 'Faol', tone: 'green' },
  blocked: { label: 'Bloklangan', tone: 'red' },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Naqd',
  online: 'Onlayn',
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: 'gray' | 'green' | 'amber' | 'red' }> = {
  pending: { label: 'Kutilmoqda', tone: 'amber' },
  paid: { label: "To'langan", tone: 'green' },
  refunded: { label: 'Qaytarilgan', tone: 'gray' },
  failed: { label: 'Xato', tone: 'red' },
};

export const ROLE_META: Record<UserRole, { label: string; tone: 'blue' | 'violet' | 'gray' }> = {
  customer: { label: 'Mijoz', tone: 'blue' },
  seller: { label: 'Sotuvchi', tone: 'violet' },
  admin: { label: 'Admin', tone: 'gray' },
};
