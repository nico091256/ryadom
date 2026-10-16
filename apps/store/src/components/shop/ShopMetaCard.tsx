'use client';

import React from 'react';
import { Percent } from 'lucide-react';
import type { Shop } from '@/lib/types';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { Card, CardHeader, DescList } from '@/components/ui';

function cityName(shop: Shop): string | null {
  const c = shop.city;
  if (!c) return null;
  const v = c.name_uz || c.name_ru || c.name_en;
  return typeof v === 'string' && v ? v : null;
}

/** Faqat o'qish uchun: platforma komissiyasi va ro'yxatdan o'tgan sana. */
export function ShopMetaCard({ shop }: { shop: Shop }) {
  const rate = Number(shop.commission_rate_percent ?? 0);
  const city = cityName(shop);

  return (
    <Card>
      <CardHeader title="Platforma shartlari" description="Bu ma'lumotlarni administrator belgilaydi" />
      <div className="p-5">
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
            <Percent className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Platforma komissiyasi</p>
            <p className="text-lg font-semibold tracking-tight text-slate-900 tabular-nums">{formatNumber(rate, Number.isInteger(rate) ? 0 : 1)}%</p>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Har bir yetkazilgan buyurtma summasidan {formatNumber(rate, Number.isInteger(rate) ? 0 : 1)}% platforma komissiyasi hisoblanadi.
        </p>
        <DescList
          items={[
            { label: "Ro'yxatdan o'tgan", value: <span title={formatDateTime(shop.created_at)}>{formatDate(shop.created_at)}</span> },
            { label: "So'nggi yangilanish", value: formatDateTime(shop.updated_at) },
            ...(city ? [{ label: 'Shahar', value: city }] : []),
            { label: 'Do\'kon ID', value: <span className="font-mono text-xs text-slate-600">{shop.id}</span> },
          ]}
        />
      </div>
    </Card>
  );
}
