'use client';

import React from 'react';
import { Banknote, Check, CreditCard, MapPin, MessageSquare, Phone, Timer, Truck, User, X } from 'lucide-react';
import { cn, formatDateTime, formatMoney, shortId, timeAgo } from '@/lib/format';
import { PAYMENT_METHOD_LABEL } from '@/lib/constants';
import type { Order } from '@/lib/types';
import { Badge, Button, StatusBadge } from '@/components/ui';
import { formatCountdown, remainingMs, URGENT_MS } from './countdown';

export type OrderAction = 'accept' | 'reject' | 'on_the_way' | 'cancel' | 'deliver';

export interface OrderCardProps {
  order: Order;
  /** Current time in ms, ticked by the parent every second (only matters for 'new' orders). */
  now: number;
  /** The action currently in flight for this order, if any. */
  acting: OrderAction | null;
  onAccept: (order: Order) => void;
  onReject: (order: Order) => void;
  onStartDelivery: (order: Order) => void;
  onCancel: (order: Order) => void;
  onDeliver: (order: Order) => void;
}

function cancelReason(order: Order): string | null {
  const history = order.status_history ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.status === 'cancelled' && h.reason) return h.reason;
  }
  const last = history[history.length - 1];
  return last?.reason ?? null;
}

export function OrderCard({ order, now, acting, onAccept, onReject, onStartDelivery, onCancel, onDeliver }: OrderCardProps) {
  const isNew = order.status === 'new';
  const left = isNew ? remainingMs(order.created_at, now) : 0;
  const urgent = isNew && left < URGENT_MS;
  const expired = isNew && left <= 0;
  const busy = acting !== null;

  const address = order.address_snapshot;
  const hasCoords = !!address && Number.isFinite(Number(address.lat)) && Number.isFinite(Number(address.lng));
  const mapHref = hasCoords ? `https://yandex.uz/maps/?text=${address!.lat},${address!.lng}` : null;

  const phone = order.customer_phone || order.customer?.phone || null;
  const customerName = order.customer?.name || 'Mijoz';
  const payLabel = PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method;
  const reason = order.status === 'cancelled' ? cancelReason(order) : null;

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border bg-white shadow-sm transition-colors',
        urgent && !expired ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200',
        expired && 'border-rose-300 opacity-80',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-900">{shortId(order.id)}</span>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500" title={formatDateTime(order.created_at)}>
            {timeAgo(order.created_at)}
          </p>
        </div>
        {isNew && (
          <div
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums',
              expired ? 'bg-rose-100 text-rose-700' : urgent ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200' : 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
            )}
            aria-live="off"
          >
            <Timer className={cn('h-4 w-4', urgent && !expired && 'animate-pulse')} />
            {expired ? 'Vaqt tugadi' : `Qabul qilish: ${formatCountdown(left)}`}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 px-4 py-3 text-sm">
        {/* Customer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <User className="h-4 w-4 text-slate-400" />
            <span className="font-medium">{customerName}</span>
          </span>
          {phone ? (
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline">
              <Phone className="h-4 w-4" />
              {phone}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Phone className="h-4 w-4" />
              Telefon yo&apos;q
            </span>
          )}
        </div>

        {/* Address */}
        {address?.text && (
          <div className="flex items-start gap-1.5 text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="break-words">{address.text}</p>
              {mapHref && (
                <a href={mapHref} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-700 hover:underline">
                  Xaritada ko&apos;rish
                </a>
              )}
            </div>
          </div>
        )}

        {/* Comment */}
        {order.comment && (
          <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900 ring-1 ring-inset ring-amber-200">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="break-words">{order.comment}</p>
          </div>
        )}

        {/* Items */}
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {(order.items ?? []).map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="min-w-0 truncate text-slate-800">
                {it.product_name}
                <span className="ml-1.5 text-slate-500">× {it.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-700">{formatMoney(it.unit_price * it.quantity)}</span>
            </li>
          ))}
          {(!order.items || order.items.length === 0) && <li className="px-3 py-1.5 text-slate-400">Mahsulotlar yo&apos;q</li>}
        </ul>

        {/* Total */}
        <div className="flex items-center justify-between gap-3">
          <Badge tone={order.payment_method === 'cash' ? 'amber' : 'blue'}>
            {order.payment_method === 'cash' ? <Banknote className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
            {payLabel}
          </Badge>
          <div className="text-right">
            {order.discount_amount > 0 && <p className="text-xs text-slate-500">Chegirma: −{formatMoney(order.discount_amount)}</p>}
            <p className="text-base font-semibold tabular-nums text-slate-900">{formatMoney(order.total_amount)}</p>
          </div>
        </div>

        {reason && (
          <p className="rounded-lg bg-rose-50 px-2.5 py-2 text-xs text-rose-800 ring-1 ring-inset ring-rose-200">
            <span className="font-semibold">Sabab:</span> {reason}
          </p>
        )}
      </div>

      {/* Actions */}
      {order.status === 'new' && (
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <Button variant="outline-danger" icon={<X className="h-4 w-4" />} onClick={() => onReject(order)} disabled={busy} loading={acting === 'reject'}>
            Rad etish
          </Button>
          <Button variant="primary" icon={<Check className="h-4 w-4" />} onClick={() => onAccept(order)} disabled={busy} loading={acting === 'accept'}>
            Qabul qilish
          </Button>
        </div>
      )}
      {order.status === 'accepted' && (
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <Button variant="primary" icon={<Truck className="h-4 w-4" />} onClick={() => onStartDelivery(order)} disabled={busy} loading={acting === 'on_the_way'}>
            Yetkazishga chiqdim
          </Button>
          <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onCancel(order)} disabled={busy} loading={acting === 'cancel'}>
            Bekor qilish
          </Button>
        </div>
      )}
      {order.status === 'on_the_way' && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <Button variant="primary" className="w-full" icon={<Check className="h-4 w-4" />} onClick={() => onDeliver(order)} disabled={busy} loading={acting === 'deliver'}>
            Yetkazib berildi
          </Button>
        </div>
      )}
    </article>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-slate-200/70" />
        <div className="h-7 w-28 rounded-lg bg-slate-200/70" />
      </div>
      <div className="mt-4 h-3.5 w-40 rounded bg-slate-200/70" />
      <div className="mt-2 h-3.5 w-56 rounded bg-slate-200/70" />
      <div className="mt-4 space-y-2 rounded-lg border border-slate-100 p-3">
        <div className="h-3.5 w-full rounded bg-slate-200/70" />
        <div className="h-3.5 w-3/4 rounded bg-slate-200/70" />
      </div>
      <div className="mt-4 flex justify-between">
        <div className="h-5 w-16 rounded-full bg-slate-200/70" />
        <div className="h-5 w-24 rounded bg-slate-200/70" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-9 rounded-lg bg-slate-200/70" />
        <div className="h-9 rounded-lg bg-slate-200/70" />
      </div>
    </div>
  );
}
