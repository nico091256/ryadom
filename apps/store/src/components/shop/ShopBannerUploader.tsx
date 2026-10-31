'use client';

import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { api, errorMessage, resolveMediaUrl } from '@/lib/api';
import type { Shop } from '@/lib/types';
import { cn } from '@/lib/format';
import { cropToBanner } from '@/lib/crop-image';
import { Button, Card, CardHeader, useToast } from '@/components/ui';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Do'kon banneri (16:9 keng rasm — mijoz ilovasida do'kon kartasi va sahifa
 * tepasida ko'rinadi). Tanlangan rasm brauzerda 16:9 ga markazdan kesiladi,
 * /uploads/image ga yuklanadi va darhol PUT /seller/shop { banner_url } bilan saqlanadi.
 */
export function ShopBannerUploader({ shop, onUpdated }: { shop: Shop; onUpdated: (shop: Shop) => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  const src = preview ?? resolveMediaUrl(shop.banner_url);
  const showImage = !!src && brokenSrc !== src;
  const busy = uploading || removing;

  const pick = () => {
    if (!busy) inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Fayl formati noto'g'ri", 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Fayl juda katta', 'Rasm hajmi 5 MB dan oshmasligi kerak');
      return;
    }

    setUploading(true);
    let localUrl: string | null = null;
    try {
      const cropped = await cropToBanner(file);
      localUrl = URL.createObjectURL(cropped);
      setPreview(localUrl);
      const url = await api.uploadImage(cropped);
      const updated = await api.updateShop({ banner_url: url });
      onUpdated(updated);
      toast.success('Banner yangilandi');
    } catch (err) {
      toast.error("Bannerni yuklab bo'lmadi", errorMessage(err));
    } finally {
      setUploading(false);
      setPreview(null);
      if (localUrl) URL.revokeObjectURL(localUrl);
    }
  };

  const remove = async () => {
    if (!shop.banner_url || busy) return;
    setRemoving(true);
    try {
      const updated = await api.updateShop({ banner_url: null });
      onUpdated(updated);
      toast.success('Banner olib tashlandi');
    } catch (err) {
      toast.error("Bannerni olib tashlab bo'lmadi", errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Do'kon banneri"
        description="Mijoz ilovasida do'kon kartasi va sahifa tepasida ko'rinadigan keng (16:9) rasm"
        actions={
          <div className="flex items-center gap-2">
            {shop.banner_url && (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={remove} loading={removing} disabled={uploading}>
                Olib tashlash
              </Button>
            )}
            <Button variant="secondary" size="sm" icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={pick} loading={uploading} disabled={removing}>
              {shop.banner_url ? "O'zgartirish" : 'Banner yuklash'}
            </Button>
          </div>
        }
      />
      <div className="p-5">
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          aria-label={shop.banner_url ? "Bannerni o'zgartirish" : 'Banner yuklash'}
          className={cn(
            'group relative aspect-video w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
            !busy && 'hover:ring-brand-400',
            busy && 'cursor-wait',
          )}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src as string} alt={`${shop.name} banneri`} className="h-full w-full object-cover" onError={() => setBrokenSrc(src)} />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm">Banner yuklash uchun bosing</span>
              <span className="text-xs text-slate-400">JPG, PNG yoki WEBP · 5 MB gacha · avtomatik 16:9 ga kesiladi</span>
            </span>
          )}

          {showImage && !busy && (
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/50 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <ImagePlus className="h-5 w-5" />
              O'zgartirish
            </span>
          )}

          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
            </span>
          )}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
      </div>
    </Card>
  );
}
