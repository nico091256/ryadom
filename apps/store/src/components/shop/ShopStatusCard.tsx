'use client';

import React from 'react';
import { AlertTriangle, Clock, MapPin, Phone, ShieldAlert } from 'lucide-react';
import type { Shop } from '@/lib/types';
import { cn } from '@/lib/format';
import { SHOP_STATUS_META } from '@/lib/constants';
import { Badge, Card, Switch } from '@/components/ui';
import { ShopLogoUploader } from './ShopLogoUploader';

const MODERATION_NOTE: Record<Shop['status'], { text: string; className: string; icon: React.ReactNode } | null> = {
  pending: {
    text: "Do'koningiz administrator tomonidan tasdiqlanmaguncha mijozlarga ko'rinmaydi.",
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />,
  },
  active: null,
  blocked: {
    text: "Do'kon bloklangan. Administrator bilan bog'laning.",
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    icon: <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />,
  },
};

export function ShopStatusCard({
  shop,
  toggling,
  onToggleOpen,
  onUpdated,
}: {
  shop: Shop;
  toggling: boolean;
  onToggleOpen: (isOpen: boolean) => void;
  onUpdated: (shop: Shop) => void;
}) {
  const meta = SHOP_STATUS_META[shop.status] ?? { label: shop.status, tone: 'gray' as const };
  const note = MODERATION_NOTE[shop.status] ?? null;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Identity */}
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <ShopLogoUploader shop={shop} onUpdated={onUpdated} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight text-slate-900">{shop.name}</h2>
              <Badge tone={meta.tone} dot>
                {meta.label}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              {shop.address_text && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{shop.address_text}</span>
                </span>
              )}
              {shop.phone && (
                <a href={`tel:${shop.phone}`} className="flex items-center gap-1.5 hover:text-brand-700">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {shop.phone}
                </a>
              )}
              {(shop.open_time || shop.close_time) && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {shop.open_time || '—'}–{shop.close_time || '—'}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">Logotipni o'zgartirish uchun rasm ustiga bosing (JPG, PNG, WEBP · 5 MB gacha)</p>
          </div>
        </div>

        {/* Open / closed switch */}
        <div
          className={cn(
            'flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors lg:w-auto lg:min-w-[320px]',
            shop.is_open ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-slate-50',
          )}
        >
          <div className="min-w-0">
            <p className={cn('text-sm font-semibold', shop.is_open ? 'text-brand-800' : 'text-slate-800')}>Buyurtma qabul qilyapman</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">
              <span className="font-medium text-slate-600">Yoqilgan:</span> mijozlar buyurtma bera oladi
              <br />
              <span className="font-medium text-slate-600">O'chirilgan:</span> do'kon ro'yxatda yopiq ko'rinadi, buyurtma qabul qilinmaydi
            </p>
          </div>
          <Switch checked={shop.is_open} onChange={onToggleOpen} disabled={toggling} label="Buyurtma qabul qilyapman" />
        </div>
      </div>

      {note && (
        <div className={cn('mt-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm', note.className)}>
          {note.icon}
          <p>{note.text}</p>
        </div>
      )}
    </Card>
  );
}
