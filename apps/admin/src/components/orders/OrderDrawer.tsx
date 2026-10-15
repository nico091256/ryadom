'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Ban, ExternalLink, MapPin, MessageSquare, Phone, Store, User } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { OrderDetail, OrderStatus } from '@/lib/types';
import { ORDER_STATUS_META, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_META } from '@/lib/constants';
import { cn, formatDateTime, formatMoney, shortId } from '@/lib/format';
import { Badge, Button, ConfirmDialog, Drawer, ErrorState, Skeleton, StatusBadge, useToast } from '@/components/ui';

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function OrderDrawer({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string | null;
  onClose: () => void;
  onChanged?: (order: OrderDetail) => void;
}) {
  const toast = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      setOrder(await api.getOrder(orderId));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setOrder(null);
    if (orderId) load();
  }, [orderId, load]);

  const cancel = async (reason: string) => {
    if (!order) return;
    setCancelling(true);
    try {
      await api.cancelOrder(order.id, reason);
      toast.success('Buyurtma bekor qilindi', shortId(order.id));
      setConfirmOpen(false);
      const fresh = await api.getOrder(order.id).catch(() => null);
      if (fresh) {
        setOrder(fresh);
        onChanged?.(fresh);
      } else {
        await load();
      }
    } catch (e) {
      toast.error('Bekor qilib bo\'lmadi', errorMessage(e));
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = order && order.status !== 'delivered' && order.status !== 'cancelled';
  const items = order?.items ?? [];
  const subtotal = items.reduce((s, it) => s + (it.total_price ?? it.unit_price * it.quantity), 0);
  const addr = order?.address_snapshot || null;
  const addrText = (addr?.text || addr?.address_text || '') as string;
  const addrExtra = [
    addr?.entrance && `Podyezd ${addr.entrance}`,
    addr?.floor && `${addr.floor}-qavat`,
    addr?.apartment && `${addr.apartment}-xonadon`,
    addr?.door_code && `Domofon: ${addr.door_code}`,
  ].filter(Boolean);
  const history = [...(order?.status_history ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <>
      <Drawer
        open={!!orderId}
        onClose={onClose}
        width="max-w-2xl"
        title={order ? `Buyurtma ${shortId(order.id)}` : 'Buyurtma'}
        description={
          order ? (
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} />
              <span>{formatDateTime(order.created_at)}</span>
            </span>
          ) : undefined
        }
        footer={
          order && (
            <>
              <Button variant="secondary" onClick={onClose}>
                Yopish
              </Button>
              {canCancel && (
                <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setConfirmOpen(true)}>
                  Bekor qilish
                </Button>
              )}
            </>
          )
        }
      >
        {loading && !order ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : order ? (
          <div className="space-y-4">
            {order.needs_attention && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Bu buyurtma e'tibor talab qiladi (uzoq vaqt qabul qilinmagan).
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Mijoz" icon={<User className="h-3.5 w-3.5" />}>
                <p className="font-medium text-slate-900">{order.customer?.name || 'Ismsiz mijoz'}</p>
                <a href={`tel:${order.customer_phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline">
                  <Phone className="h-3.5 w-3.5" />
                  {order.customer_phone || order.customer?.phone || '—'}
                </a>
              </Section>
              <Section title="Do'kon" icon={<Store className="h-3.5 w-3.5" />}>
                {order.shop ? (
                  <>
                    <Link href={`/shops/${order.shop.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                      {order.shop.name}
                    </Link>
                    {order.shop.phone && (
                      <a href={`tel:${order.shop.phone}`} className="mt-1 flex items-center gap-1.5 text-sm text-brand-700 hover:underline">
                        <Phone className="h-3.5 w-3.5" />
                        {order.shop.phone}
                      </a>
                    )}
                    {order.shop.address_text && <p className="mt-1 text-xs text-slate-500">{order.shop.address_text}</p>}
                  </>
                ) : (
                  '—'
                )}
              </Section>
            </div>

            <Section title="Yetkazib berish manzili" icon={<MapPin className="h-3.5 w-3.5" />}>
              {addr ? (
                <div className="space-y-1 text-sm">
                  {addr.title && <p className="font-medium text-slate-900">{addr.title}</p>}
                  <p className="text-slate-700">{addrText || '—'}</p>
                  {addrExtra.length > 0 && <p className="text-slate-500">{addrExtra.join(' · ')}</p>}
                  {typeof addr.lat === 'number' && typeof addr.lng === 'number' && (
                    <a
                      href={`https://yandex.uz/maps/?pt=${addr.lng},${addr.lat}&z=17&l=map`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                    >
                      Xaritada ko'rish <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Manzil ma'lumoti yo'q</p>
              )}
            </Section>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mahsulotlar ({items.length})
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Nomi</th>
                      <th className="px-4 py-2 text-right font-medium">Narxi</th>
                      <th className="px-4 py-2 text-right font-medium">Soni</th>
                      <th className="px-4 py-2 text-right font-medium">Jami</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-4 py-2 text-slate-900">{it.product_name}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-slate-600">{formatMoney(it.unit_price)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-600">× {it.quantity}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums text-slate-900">
                          {formatMoney(it.total_price ?? it.unit_price * it.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Mahsulotlar</dt>
                  <dd className="tabular-nums text-slate-700">{formatMoney(subtotal)}</dd>
                </div>
                {(order.discount_amount > 0 || order.promo_code) && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">
                      Chegirma{' '}
                      {order.promo_code && (
                        <Badge tone="green" className="ml-1 font-mono">
                          {order.promo_code}
                        </Badge>
                      )}
                    </dt>
                    <dd className="tabular-nums text-rose-600">−{formatMoney(order.discount_amount)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold">
                  <dt className="text-slate-900">Jami</dt>
                  <dd className="tabular-nums text-slate-900">{formatMoney(order.total_amount)}</dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Platforma komissiyasi</dt>
                  <dd className="tabular-nums text-slate-600">{formatMoney(order.commission_amount)}</dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <dt className="text-slate-500">To'lov</dt>
                  <dd className="flex items-center gap-1.5">
                    <Badge tone="gray">{PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}</Badge>
                    <Badge tone={PAYMENT_STATUS_META[order.payment_status]?.tone ?? 'gray'}>
                      {PAYMENT_STATUS_META[order.payment_status]?.label ?? order.payment_status}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </section>

            {order.comment && (
              <Section title="Izoh" icon={<MessageSquare className="h-3.5 w-3.5" />}>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{order.comment}</p>
              </Section>
            )}

            <Section title="Holatlar tarixi">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500">Tarix mavjud emas</p>
              ) : (
                <ol className="relative space-y-4 pl-6">
                  <span className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />
                  {history.map((h) => {
                    const st = (h.to_status || h.status) as OrderStatus;
                    const meta = ORDER_STATUS_META[st];
                    return (
                      <li key={h.id} className="relative">
                        <span
                          className={cn('absolute -left-6 top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white', meta?.dot ?? 'bg-slate-400')}
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-sm font-medium text-slate-900">{meta?.label ?? st}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(h.created_at)}</p>
                        </div>
                        {h.actor?.name && <p className="text-xs text-slate-500">{h.actor.name}</p>}
                        {h.reason && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">Sabab: {h.reason}</p>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={cancel}
        loading={cancelling}
        title="Buyurtmani bekor qilish"
        message="Mijoz va do'konga xabar yuboriladi, mahsulotlar zaxirasi tiklanadi. Bu amalni qaytarib bo'lmaydi."
        confirmLabel="Bekor qilish"
        cancelLabel="Ortga"
        reason={{ label: 'Sabab', placeholder: "Masalan: mijoz bilan bog'lanib bo'lmadi", required: true }}
      />
    </>
  );
}
