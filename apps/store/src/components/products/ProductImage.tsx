'use client';

import React, { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import { cn } from '@/lib/format';

/** Product thumbnail: resolves server-relative upload paths, falls back to a placeholder when missing or broken. */
export function ProductImage({
  src,
  alt = '',
  size = 'md',
  className,
}: {
  src: string | null | undefined;
  alt?: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const url = resolveMediaUrl(src);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  const cls = size === 'lg' ? 'h-24 w-24' : 'h-10 w-10';

  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        onError={() => setBroken(true)}
        className={cn(cls, 'shrink-0 rounded-lg bg-slate-100 object-cover ring-1 ring-slate-200', className)}
      />
    );
  }
  return (
    <div
      className={cn(
        cls,
        'flex shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-slate-200',
        className,
      )}
      aria-hidden="true"
    >
      <ImageIcon className={size === 'lg' ? 'h-8 w-8' : 'h-4 w-4'} />
    </div>
  );
}
