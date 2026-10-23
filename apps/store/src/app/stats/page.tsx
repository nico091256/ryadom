'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CalendarRange, Info, RefreshCw, Sun } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { SellerStats, SellerStatsBucket } from '@/lib/types';
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
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      setRefreshing(true);
      try {
        const s = await api.getStats();
        setStats(s);
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
