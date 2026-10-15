import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Group digits with a regular space: 1250000 -> "1 250 000". */
export function formatNumber(n: number | null | undefined, decimals = 0): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '0';
  const fixed = v.toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac ? `${grouped},${frac}` : grouped;
}

/** Money is stored in tiyin (1 so'm = 100 tiyin). */
export function formatMoney(tiyin: number | null | undefined): string {
  return `${formatNumber(Math.round(Number(tiyin ?? 0) / 100))} so'm`;
}

/** Compact money for chart axes: 1.2 mln, 350 ming. */
export function formatMoneyShort(tiyin: number): string {
  const som = tiyin / 100;
  if (som >= 1_000_000_000) return `${(som / 1_000_000_000).toFixed(1).replace('.0', '')} mlrd`;
  if (som >= 1_000_000) return `${(som / 1_000_000).toFixed(1).replace('.0', '')} mln`;
  if (som >= 1_000) return `${Math.round(som / 1_000)} ming`;
  return `${Math.round(som)}`;
}

export const tiyinToSom = (t: number | null | undefined) => (t == null ? '' : String(Math.round(t / 100)));
export const somToTiyin = (s: string) => Math.round(Number(s.replace(/\s/g, '')) * 100);

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatShortDate(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hozirgina';
  if (diff < 3600) return `${Math.floor(diff / 60)} daq oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} kun oldin`;
  return formatDate(iso);
}

export function shortId(id: string | null | undefined): string {
  return id ? `#${id.slice(0, 8).toUpperCase()}` : '—';
}

/** YYYY-MM-DD in local time. */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 1e9);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}
