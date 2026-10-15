'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  Package,
  Percent,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { ORDER_STATUSES, ORDER_STATUS_META } from '@/lib/constants';
import { formatMoney, formatNumber, shortId, timeAgo } from '@/lib/format';
import { useInterval } from '@/lib/hooks';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
  Table,
  TableSkeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { DailyChart } from '@/components/DailyChart';
import { OrderDrawer } from '@/components/orders/OrderDrawer';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const s = await api.getStats();
      setStats(s);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useInterval(load, 30_000);

  const t = stats?.totals;
  const loading = !stats && !error;
  const totalByStatus = stats ? ORDER_STATUSES.reduce((s, k) => s + (stats.ordersByStatus?.[k] ?? 0), 0) : 0;
  const daily = stats?.daily ?? [];
  const sum30 = daily.reduce(
    (acc, d) => ({ orders: acc.orders + d.orders, rev: acc.rev + d.revenueTiyin }),
    { orders: 0, rev: 0 },
  );
  const topMax = Math.max(1, ...(stats?.topShops ?? []).map((s) => s.revenueTiyin));

  return (
    <div>
      <PageHeader
        title="Xush kelibsiz"
        description={
          updatedAt
            ? `Platforma ko'rsatkichlari · har 30 soniyada yangilanadi · oxirgi: ${updatedAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : "Platforma ko'rsatkichlari"
        }
        actions={
          <Button variant="secondary" icon={<RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />} onClick={load} disabled={refreshing}>
            Yangilash
          </Button>
        }
      />

      {error && !stats ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              loading={loading}
              label="Bugungi buyurtmalar"
              value={formatNumber(t?.ordersToday)}
              hint={`Jami: ${formatNumber(t?.orders)} ta`}
              icon={<ShoppingBag className="h-5 w-5" />}
              tone="green"
            />
            <StatCard
              loading={loading}
              label="Bugungi tushum"
              value={formatMoney(t?.revenueTodayTiyin)}
              hint={`Jami: ${formatMoney(t?.revenueTiyin)}`}
              icon={<Banknote className="h-5 w-5" />}
              tone="blue"
            />
            <StatCard
              loading={loading}
              label="Platforma komissiyasi"
              value={formatMoney(t?.commissionTiyin)}
              hint={`O'rtacha chek: ${formatMoney(t?.avgOrderTiyin)}`}
              icon={<Percent className="h-5 w-5" />}
              tone="violet"
            />
            <StatCard
              loading={loading}
              label="Bekor qilish darajasi"
              value={`${(t?.cancelRatePercent ?? 0).toFixed(1).replace('.', ',')}%`}
              hint={`${formatNumber(stats?.ordersByStatus?.cancelled)} ta bekor qilingan`}
              icon={<XCircle className="h-5 w-5" />}
              tone="rose"
            />
            <StatCard
              loading={loading}
              label="Do'konlar"
              value={formatNumber(t?.shops)}
              hint={`${formatNumber(t?.activeShops)} faol · ${formatNumber(t?.openShopsNow)} hozir ochiq`}
              icon={<Store className="h-5 w-5" />}
              tone="amber"
            />
            <StatCard
              loading={loading}
              label="Mijozlar"
              value={formatNumber(t?.customers)}
              hint={`${formatNumber(t?.sellers)} ta sotuvchi`}
              icon={<Users className="h-5 w-5" />}
              tone="blue"
            />
            <StatCard
              loading={loading}
              label="Mahsulotlar"
              value={formatNumber(t?.products)}
              hint="Katalogdagi faol mahsulotlar"
              icon={<Package className="h-5 w-5" />}
              tone="slate"
            />
            <StatCard
              loading={loading}
              label="30 kunlik tushum"
              value={formatMoney(sum30.rev)}
              hint={`${formatNumber(sum30.orders)} ta buyurtma`}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="green"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="So'nggi 30 kun" description="Kunlik buyurtmalar soni va yetkazilgan buyurtmalar tushumi" />
              <div className="p-5">{loading ? <Skeleton className="h-64 w-full" /> : <DailyChart data={daily} />}</div>
            </Card>

            <Card>
              <CardHeader title="Holatlar bo'yicha" description={`Jami ${formatNumber(totalByStatus)} ta buyurtma`} />
              <div className="space-y-4 p-5">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                ) : (
                  <>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                      {ORDER_STATUSES.map((s) => {
                        const v = stats?.ordersByStatus?.[s] ?? 0;
                        if (!v) return null;
                        return (
                          <div
                            key={s}
                            title={`${ORDER_STATUS_META[s].label}: ${v}`}
                            style={{ width: `${(v / Math.max(1, totalByStatus)) * 100}%`, background: ORDER_STATUS_META[s].bar }}
                          />
                        );
                      })}
                    </div>
                    <ul className="space-y-2.5">
                      {ORDER_STATUSES.map((s) => {
                        const v = stats?.ordersByStatus?.[s] ?? 0;
                        const pct = totalByStatus ? (v / totalByStatus) * 100 : 0;
                        return (
                          <li key={s}>
                            <Link href={`/orders?status=${s}`} className="flex items-center gap-3 rounded-lg px-1 py-0.5 text-sm hover:bg-slate-50">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORDER_STATUS_META[s].bar }} />
                              <span className="flex-1 text-slate-700">{ORDER_STATUS_META[s].label}</span>
                              <span className="font-medium tabular-nums text-slate-900">{formatNumber(v)}</span>
                              <span className="w-12 text-right text-xs tabular-nums text-slate-400">{pct.toFixed(0)}%</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader
                title="Top do'konlar"
                description="30 kunlik tushum bo'yicha"
                actions={
                  <Link href="/shops" className="text-xs font-medium text-brand-700 hover:underline">
                    Barchasi
                  </Link>
                }
              />
              <div className="p-5">
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : !stats?.topShops?.length ? (
                  <EmptyState icon={<Store className="h-6 w-6" />} title="Hali ma'lumot yo'q" description="Yetkazilgan buyurtmalar paydo bo'lgach shu yerda ko'rinadi." />
                ) : (
                  <ol className="space-y-4">
                    {stats.topShops.map((s, i) => (
                      <li key={s.id}>
                        <Link href={`/shops/${s.id}`} className="group block">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {i + 1}
                            </span>
                            <span className="flex-1 truncate font-medium text-slate-900 group-hover:text-brand-700">{s.name}</span>
                            <span className="whitespace-nowrap tabular-nums text-slate-700">{formatMoney(s.revenueTiyin)}</span>
                          </div>
                          <div className="ml-9 mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(s.revenueTiyin / topMax) * 100}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-slate-400">{formatNumber(s.orders)} ta</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden xl:col-span-2">
              <CardHeader
                title="So'nggi buyurtmalar"
                actions={
                  <Link href="/orders" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                    Barchasi <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <Table>
                <THead>
                  <TH>Buyurtma</TH>
                  <TH>Mijoz</TH>
                  <TH>Do'kon</TH>
                  <TH>Holat</TH>
                  <TH align="right">Summa</TH>
                </THead>
                <TBody>
                  {loading ? (
                    <TableSkeleton rows={6} cols={5} />
                  ) : !stats?.recentOrders?.length ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState title="Buyurtmalar yo'q" />
                      </td>
                    </tr>
                  ) : (
                    stats.recentOrders.map((o) => (
                      <TR key={o.id} onClick={() => setOrderId(o.id)}>
                        <TD>
                          <p className="font-mono text-xs font-semibold text-slate-900">{shortId(o.id)}</p>
                          <p className="text-xs text-slate-400">{timeAgo(o.created_at)}</p>
                        </TD>
                        <TD>
                          <p className="text-slate-900">{o.customer?.name || 'Ismsiz'}</p>
                          <p className="text-xs text-slate-400">{o.customer_phone}</p>
                        </TD>
                        <TD className="max-w-[180px] truncate">{o.shop?.name ?? '—'}</TD>
                        <TD>
                          <StatusBadge status={o.status} />
                        </TD>
                        <TD align="right" className="font-medium tabular-nums text-slate-900">
                          {formatMoney(o.total_amount)}
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </Card>
          </div>
        </div>
      )}

      <OrderDrawer orderId={orderId} onClose={() => setOrderId(null)} onChanged={() => load()} />
    </div>
  );
}
