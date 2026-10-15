'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FilterX, ShoppingBag } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { OrderStatus, OrderSummary, Paginated, Shop } from '@/lib/types';
import { ORDER_STATUSES, ORDER_STATUS_META, PAYMENT_METHOD_LABEL } from '@/lib/constants';
import { formatDateTime, formatMoney, formatNumber, shortId } from '@/lib/format';
import { useDebounce, useInterval } from '@/lib/hooks';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  Table,
  TableSkeleton,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { OrderDrawer } from '@/components/orders/OrderDrawer';

const LIMIT = 20;
type StatusFilter = OrderStatus | 'all';

function OrdersInner() {
  const params = useSearchParams();
  const initialStatus = (params?.get('status') as StatusFilter) || 'all';

  const [status, setStatus] = useState<StatusFilter>(ORDER_STATUSES.includes(initialStatus as OrderStatus) ? initialStatus : 'all');
  const [shopId, setShopId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q.trim());
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<Paginated<OrderSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [counts, setCounts] = useState<Record<OrderStatus, number> | null>(null);
  const [orderId, setOrderId] = useState<string | null>(params?.get('id') || null);

  useEffect(() => {
    api
      .getShops({ limit: 100 })
      .then((r) => setShops(r.data))
      .catch(() => setShops([]));
  }, []);

  const loadCounts = useCallback(() => {
    api
      .getStats()
      .then((s) => setCounts(s.ordersByStatus))
      .catch(() => setCounts(null));
  }, []);
  useEffect(loadCounts, [loadCounts]);

  const seq = useRef(0);
  const load = useCallback(
    async (silent = false) => {
      const my = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const r = await api.getOrders({
          status: status === 'all' ? undefined : status,
          shopId: shopId || undefined,
          paymentMethod: paymentMethod || undefined,
          q: dq || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit: LIMIT,
        });
        if (my !== seq.current) return;
        setResult(r);
        setError(null);
      } catch (e) {
        if (my === seq.current) setError(errorMessage(e));
      } finally {
        if (my === seq.current) setLoading(false);
      }
    },
    [status, shopId, paymentMethod, dq, from, to, page],
  );

  useEffect(() => {
    load();
  }, [load]);

  useInterval(() => {
    load(true);
    loadCounts();
  }, 30_000);

  // Reset to first page whenever a filter changes
  useEffect(() => setPage(1), [status, shopId, paymentMethod, dq, from, to]);

  const hasFilters = !!(shopId || paymentMethod || from || to || q);
  const clearFilters = () => {
    setShopId('');
    setPaymentMethod('');
    setFrom('');
    setTo('');
    setQ('');
  };

  const totalCount = counts ? ORDER_STATUSES.reduce((s, k) => s + (counts[k] ?? 0), 0) : null;
  const tabs = [
    { value: 'all' as StatusFilter, label: 'Hammasi', count: totalCount },
    ...ORDER_STATUSES.map((s) => ({ value: s as StatusFilter, label: ORDER_STATUS_META[s].label, count: counts ? counts[s] ?? 0 : null })),
  ];

  const rows = result?.data ?? [];

  return (
    <div>
      <PageHeader title="Buyurtmalar" description="Platformadagi barcha buyurtmalarni kuzating va boshqaring" />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-2">
          <Tabs<StatusFilter> items={tabs} value={status} onChange={setStatus} />
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <SearchInput value={q} onChange={setQ} placeholder="ID, telefon yoki ism" className="lg:col-span-2" />
          <Select value={shopId} onChange={(e) => setShopId(e.target.value)} aria-label="Do'kon">
            <option value="">Barcha do'konlar</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} aria-label="To'lov usuli">
            <option value="">Barcha to'lovlar</option>
            <option value="cash">{PAYMENT_METHOD_LABEL.cash}</option>
            <option value="online">{PAYMENT_METHOD_LABEL.online}</option>
          </Select>
          <div className="flex items-center gap-2 lg:col-span-2">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Sanadan" />
            <span className="text-slate-400">—</span>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Sanagacha" />
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} title="Filtrlarni tozalash">
                <FilterX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {error && !result ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Buyurtma</TH>
                <TH>Mijoz</TH>
                <TH>Do'kon</TH>
                <TH>Holat</TH>
                <TH>To'lov</TH>
                <TH align="right">Mahsulot</TH>
                <TH align="right">Summa</TH>
              </THead>
              <TBody>
                {loading && !result ? (
                  <TableSkeleton rows={8} cols={7} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={<ShoppingBag className="h-6 w-6" />}
                        title="Buyurtmalar topilmadi"
                        description={hasFilters || status !== 'all' ? "Filtrlarni o'zgartirib ko'ring." : "Hali birorta buyurtma yo'q."}
                        action={
                          hasFilters ? (
                            <Button variant="secondary" size="sm" onClick={clearFilters}>
                              Filtrlarni tozalash
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((o) => (
                    <TR key={o.id} onClick={() => setOrderId(o.id)} className={loading ? 'opacity-60' : undefined}>
                      <TD>
                        <p className="font-mono text-xs font-semibold text-slate-900">{shortId(o.id)}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(o.created_at)}</p>
                      </TD>
                      <TD>
                        <p className="text-slate-900">{o.customer?.name || 'Ismsiz'}</p>
                        <p className="text-xs text-slate-400">{o.customer_phone}</p>
                      </TD>
                      <TD className="max-w-[200px] truncate">{o.shop?.name ?? '—'}</TD>
                      <TD>
                        <StatusBadge status={o.status} />
                      </TD>
                      <TD>
                        <span className="text-slate-700">{PAYMENT_METHOD_LABEL[o.payment_method] ?? o.payment_method}</span>
                        {o.promo_code && (
                          <Badge tone="green" className="ml-2 font-mono">
                            {o.promo_code}
                          </Badge>
                        )}
                      </TD>
                      <TD align="right" className="tabular-nums">
                        {formatNumber(o.itemsCount ?? 0)}
                      </TD>
                      <TD align="right">
                        <p className="font-medium tabular-nums text-slate-900">{formatMoney(o.total_amount)}</p>
                        {o.discount_amount > 0 && (
                          <p className="text-xs tabular-nums text-rose-500">−{formatMoney(o.discount_amount)}</p>
                        )}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
            {result && result.total > 0 && <Pagination page={page} limit={result.limit || LIMIT} total={result.total} onChange={setPage} />}
          </>
        )}
      </Card>

      <OrderDrawer
        orderId={orderId}
        onClose={() => setOrderId(null)}
        onChanged={() => {
          load(true);
          loadCounts();
        }}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersInner />
    </Suspense>
  );
}
