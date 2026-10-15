'use client';

import React, { useState } from 'react';
import { cn, formatMoney, formatMoneyShort, formatNumber, formatShortDate } from '@/lib/format';

interface Point {
  date: string;
  orders: number;
  revenueTiyin: number;
}

/** Axis max = 4 * a 'nice' step (1, 2, 2.5, 5 x 10^n) so all four ticks are round numbers. */
function niceMax(v: number, floor: number, integer = false): number {
  const raw = Math.max(v, floor) / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  if (integer) step = Math.max(1, Math.ceil(step));
  return step * 4;
}

/** Orders as bars (left axis) + delivered revenue as a line (right axis). */
export function DailyChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxOrders = niceMax(Math.max(...data.map((d) => d.orders), 0), 4, true);
  const maxRev = niceMax(Math.max(...data.map((d) => d.revenueTiyin), 0), 10_000_000); // floor: 100 000 so'm
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const n = data.length;

  const linePoints = data
    .map((d, i) => `${((i + 0.5) / n) * 100},${100 - (d.revenueTiyin / maxRev) * 100}`)
    .join(' ');

  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Buyurtmalar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-sky-500" /> Tushum (yetkazilgan)
        </span>
      </div>
      <div className="flex gap-2">
        {/* Left axis */}
        <div className="flex h-56 flex-col justify-between py-0 text-right text-[10px] tabular-nums text-slate-400">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {formatNumber(Math.round(maxOrders * t))}
            </span>
          ))}
        </div>

        <div className="relative h-56 flex-1" onMouseLeave={() => setHover(null)}>
          {/* Grid */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ top: `${(1 - t) * 100}%` }} />
          ))}

          {/* Bars */}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <div
                key={d.date}
                className="flex h-full flex-1 items-end justify-center px-[2px]"
                onMouseEnter={() => setHover(i)}
              >
                <div
                  className={cn(
                    'w-full max-w-[18px] rounded-t-[3px] transition-colors',
                    hover === i ? 'bg-brand-600' : 'bg-brand-400/80',
                  )}
                  style={{ height: `${(d.orders / maxOrders) * 100}%`, minHeight: d.orders > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>

          {/* Revenue line */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={linePoints}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {hover != null && h && (
            <>
              <div
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow"
                style={{ left: `${((hover + 0.5) / n) * 100}%`, top: `${100 - (h.revenueTiyin / maxRev) * 100}%` }}
              />
              <div
                className={cn(
                  'pointer-events-none absolute top-2 z-10 w-44 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-lg',
                  hover > n / 2 ? '-translate-x-full' : '',
                )}
                style={{ left: `calc(${((hover + 0.5) / n) * 100}% ${hover > n / 2 ? '- 10px' : '+ 10px'})` }}
              >
                <p className="mb-1.5 font-semibold text-slate-900">{formatShortDate(h.date)}</p>
                <p className="flex justify-between text-slate-600">
                  <span>Buyurtmalar</span>
                  <span className="font-medium tabular-nums text-slate-900">{formatNumber(h.orders)}</span>
                </p>
                <p className="flex justify-between gap-2 text-slate-600">
                  <span>Tushum</span>
                  <span className="font-medium tabular-nums text-slate-900">{formatMoney(h.revenueTiyin)}</span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right axis */}
        <div className="hidden h-56 flex-col justify-between text-[10px] tabular-nums text-sky-500 sm:flex">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {formatMoneyShort(maxRev * t)}
            </span>
          ))}
        </div>
      </div>
      {/* X labels */}
      <div className="ml-8 mt-2 flex text-[10px] text-slate-400 sm:mr-12">
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 5 === 0 || i === n - 1 ? formatShortDate(d.date) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
