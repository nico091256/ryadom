'use client';

import React, { useRef, useState } from 'react';
import { Camera, Loader2, Store } from 'lucide-react';
import { api, errorMessage, resolveMediaUrl } from '@/lib/api';
import type { Shop } from '@/lib/types';
import { cn } from '@/lib/format';
import { useToast } from '@/components/ui';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Do'kon logotipi. Bosilganda fayl tanlanadi -> /uploads/image -> darhol PUT /seller/shop { logo_url }.
 */
export function ShopLogoUploader({
  shop,
  onUpdated,
  className,
}: {
  shop: Shop;
  onUpdated: (shop: Shop) => void;
  className?: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  const src = resolveMediaUrl(shop.logo_url);
  const showImage = !!src && brokenSrc !== src;

  const pick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file next time.
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
    try {
      const url = await api.uploadImage(file);
      const updated = await api.updateShop({ logo_url: url });
      onUpdated(updated);
      toast.success('Logotip yangilandi');
    } catch (err) {
      toast.error("Logotipni yuklab bo'lmadi", errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('relative shrink-0', className)}>
      <button
        type="button"
        onClick={pick}
        disabled={uploading}
        title="Logotipni o'zgartirish"
        aria-label="Logotipni o'zgartirish"
        className={cn(
          'group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:h-24 sm:w-24',
          !uploading && 'hover:ring-brand-400',
          uploading && 'cursor-wait',
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src as string} alt={shop.name} className="h-full w-full object-cover" onError={() => setBrokenSrc(src)} />
        ) : (
          <Store className="h-8 w-8 text-slate-400" />
        )}

        {/* Hover overlay */}
        {!uploading && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-slate-900/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="h-5 w-5" />
            <span className="text-[10px] font-medium">O'zgartirish</span>
          </span>
        )}

        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </span>
        )}
      </button>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
    </div>
  );
}
