'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CalendarDays, CalendarRange, Info, Package, RefreshCw, ShoppingBag, Sun, TrendingUp } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Order, Product, SellerStats, SellerStatsBucket } from '@/lib/types';
import { formatMoney, formatNumber } from '@/lib/format';
import { useInterval } from '@/lib/hooks';
import { Button, Card, ErrorState, PageHeader, StatCard, useToast } from '@/components/ui';

const REFRESH_MS = 60_000;

function orderCountHint(bucket: SellerStatsBucket | undefined): string {
  return `${formatNumber(bucket?.orderCount)} ta buyurtma`;
}

export default function StatsPage() {
  const toast = useToast();
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      setRefreshing(true);
      try {
        const [s, prods, ords] = await Promise.all([
          api.getStats(),
          api.getProducts().catch(() => null),
          api.getOrders({ limit: 100 }).then((r) => r.data).catch(() => null),
        ]);
        setStats(s);
        if (prods) setProducts(prods);
        if (ords) setOrders(ords);
        setError(null);
        setUpdatedAt(new Date());
      } catch (e) {
        const msg = errorMessage(e);
        setError(msg);
        // When data is already on screen, a failed background refresh should not wipe it - just notify.
        if (!opts.silent) toast.error('Statistikani yangilab bo‘lmadi', msg);
      } finally {
        setRefreshing(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    load({ silent: true });
  }, [load]);
  useInterval(() => load({ silent: true }), REFRESH_MS);

  const loading = !stats && !error;
  const showError = !!error && !stats;

  const totalProducts = products?.length ?? 0;
  const availableProducts = products?.filter((p) => p.is_available && (p.stock ?? 0) > 0).length ?? 0;
  const outOfStockProducts = products?.filter((p) => (p.stock ?? 0) <= 0).length ?? 0;
  const activeOrders = orders?.filter((o) => o.status === 'new' || o.status === 'accepted' || o.status === 'on_the_way').length ?? 0;
  const monthOrders = stats?.thisMonth?.orderCount ?? 0;
  const avgOrderTiyin = monthOrders > 0 ? Math.round((stats?.thisMonth?.revenueTiyin ?? 0) / monthOrders) : 0;

  return (
    <div>
      <PageHeader
        title="Statistika"
        description={
          updatedAt
            ? `Do'kon ko'rsatkichlari · har daqiqada yangilanadi · oxirgi: ${updatedAt.toLocaleTimeString('uz-UZ', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}`
            : "Do'kon ko'rsatkichlari · har daqiqada yangilanadi"
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            onClick={() => load()}
            disabled={refreshing}
          >
            Yangilash
          </Button>
        }
      />

      {showError ? (
        <Card>
          <ErrorState message={error as string} onRetry={() => load({ silent: true })} />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              loading={loading}
              label="Bugun"
              value={formatMoney(stats?.today?.revenueTiyin)}
              hint={orderCountHint(stats?.today)}
              icon={<Sun className="h-5 w-5" />}
              tone="green"
            />
            <StatCard
              loading={loading}
              label="Shu hafta"
              value={formatMoney(stats?.thisWeek?.revenueTiyin)}
              hint={orderCountHint(stats?.thisWeek)}
              icon={<CalendarDays className="h-5 w-5" />}
              tone="blue"
            />
            <StatCard
              loading={loading}
              label="Shu oy"
              value={formatMoney(stats?.thisMonth?.revenueTiyin)}
              hint={orderCountHint(stats?.thisMonth)}
              icon={<CalendarRange className="h-5 w-5" />}
              tone="violet"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <StatCard
              loading={loading}
              label="O'rtacha chek (oylik)"
              value={formatMoney(avgOrderTiyin)}
              hint="Shu oydagi buyurtmalar bo'yicha"
              icon={<TrendingUp className="h-5 w-5" />}
              tone="amber"
            />
            <StatCard
              loading={loading && !orders}
              label="Faol buyurtmalar"
              value={formatNumber(activeOrders)}
              hint={
                <Link href="/" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                  Buyurtmalarga o&apos;tish <ArrowRight className="h-3 w-3" />
                </Link>
              }
              icon={<ShoppingBag className="h-5 w-5" />}
              tone="blue"
            />
            <StatCard
              loading={loading && !products}
              label="Mahsulotlar katalogi"
              value={formatNumber(totalProducts)}
              hint={`${formatNumber(availableProducts)} ta sotuvda`}
              icon={<Package className="h-5 w-5" />}
              tone="slate"
            />
            <StatCard
              loading={loading && !products}
              label="Tugagan mahsulotlar"
              value={formatNumber(outOfStockProducts)}
              hint={
                <Link href="/products" className="inline-flex items-center gap-1 font-medium text-rose-600 hover:underline">
                  Qoldiqni to&apos;ldirish <ArrowRight className="h-3 w-3" />
                </Link>
              }
              icon={<AlertTriangle className="h-5 w-5" />}
              tone={outOfStockProducts > 0 ? 'rose' : 'green'}
            />
          </div>

          <Card className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Info className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Izoh</p>
              <p className="mt-0.5 text-sm text-slate-500">
                Buyurtmalar soni shu davrda yaratilgan, bekor qilinmagan buyurtmalar bo'yicha; tushum esa faqat yetkazilgan buyurtmalar bo'yicha hisoblanadi.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
