'use client';

import React, { useState } from 'react';
import type { Shop } from '@/lib/types';

export function ShopLogo({ shop, size = 'md' }: { shop: Pick<Shop, 'name' | 'logo_url'>; size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-14 w-14 text-xl' : 'h-9 w-9 text-sm';
  const [broken, setBroken] = useState(false);
  if (shop.logo_url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={shop.logo_url} alt="" onError={() => setBroken(true)} className={`${cls} shrink-0 rounded-lg object-cover ring-1 ring-slate-200`} />;
  }
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100`}>
      {shop.name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}
