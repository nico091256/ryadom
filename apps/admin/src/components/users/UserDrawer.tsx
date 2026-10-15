'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, MapPin, ShoppingBag, Store, Unlock } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { UserDetail } from '@/lib/types';
import { ROLE_META } from '@/lib/constants';
import { formatDate, formatDateTime, formatMoney, formatNumber, shortId } from '@/lib/format';
import { Badge, Button, DescList, Drawer, EmptyState, ErrorState, Skeleton, StatusBadge } from '@/components/ui';

export function UserDrawer({
  userId,
  onClose,
  onToggleBlock,
  onOpenOrder,
}: {
  userId: string | null;
  onClose: () => void;
  onToggleBlock: (u: { id: string; name: string | null; is_blocked: boolean; role: string }) => void;
  onOpenOrder: (id: string) => void;
}) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setUser(await api.getUserDetail(userId));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [userId]);

  useEffect(() => {
    setUser(null);
    if (userId) load();
  }, [userId, load]);

  // Keep the block state in sync when the parent page toggles it
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; is_blocked: boolean };
      setUser((u) => (u && u.id === d.id ? { ...u, is_blocked: d.is_blocked } : u));
    };
    window.addEventListener('ryadom:user-updated', handler);
    return () => window.removeEventListener('ryadom:user-updated', handler);
  }, []);

  const role = user ? ROLE_META[user.role] : null;

  return (
    <Drawer
      open={!!userId}
      onClose={onClose}
      title={user ? user.name || user.login || user.phone || 'Foydalanuvchi' : 'Foydalanuvchi'}
      description={
        user && (
          <span className="flex flex-wrap items-center gap-2">
            {role && <Badge tone={role.tone}>{role.label}</Badge>}
            {user.is_blocked && <Badge tone="red">Bloklangan</Badge>}
            <span>{formatDate(user.created_at)} dan beri</span>
          </span>
        )
      }
      footer={
        user && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Yopish
            </Button>
            {user.role !== 'admin' &&
              (user.is_blocked ? (
                <Button icon={<Unlock className="h-4 w-4" />} onClick={() => onToggleBlock(user)}>
                  Blokdan chiqarish
                </Button>
              ) : (
                <Button variant="danger" icon={<Lock className="h-4 w-4" />} onClick={() => onToggleBlock(user)}>
                  Bloklash
                </Button>
              ))}
          </>
        )
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !user ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Buyurtmalar</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{formatNumber(user.ordersCount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Jami xarid</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{formatMoney(user.totalSpentTiyin)}</p>
            </div>
          </div>

          <DescList
            items={[
              { label: 'Telefon', value: user.phone || '—' },
              { label: 'Login', value: user.login ? <span className="font-mono">@{user.login}</span> : '—' },
              { label: 'Til', value: (user.language || 'uz').toUpperCase() },
              {
                label: "Do'kon",
                value: user.shop ? (
                  <Link href={`/shops/${user.shop.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    <Store className="h-3.5 w-3.5" />
                    {user.shop.name}
                  </Link>
                ) : (
                  '—'
                ),
              },
            ]}
          />

          {user.role === 'customer' && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Manzillar ({user.addresses.length})</h3>
              {user.addresses.length === 0 ? (
                <p className="text-sm text-slate-500">Saqlangan manzillar yo'q</p>
              ) : (
                <ul className="space-y-2">
                  {user.addresses.map((a) => (
                    <li key={a.id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-slate-900">{a.title}</p>
                        <p className="text-slate-600">{a.address_text}</p>
                        {(a.entrance || a.floor || a.apartment) && (
                          <p className="text-xs text-slate-400">
                            {[a.entrance && `Podyezd ${a.entrance}`, a.floor && `${a.floor}-qavat`, a.apartment && `${a.apartment}-xonadon`]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {user.role === 'customer' && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">So'nggi buyurtmalar</h3>
              {user.recentOrders.length === 0 ? (
                <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Buyurtmalar yo'q" className="py-6" />
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {user.recentOrders.map((o) => (
                    <li key={o.id}>
                      <button onClick={() => onOpenOrder(o.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs font-semibold text-slate-900">{shortId(o.id)}</p>
                          <p className="truncate text-xs text-slate-500">
                            {o.shop?.name} · {formatDateTime(o.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={o.status} />
                        <span className="w-28 text-right text-sm font-medium tabular-nums text-slate-900">{formatMoney(o.total_amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
