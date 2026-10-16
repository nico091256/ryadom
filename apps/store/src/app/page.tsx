'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCircle2, Clock, Inbox, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatMoney, shortId } from '@/lib/format';
import { useInterval } from '@/lib/hooks';
import { getSocket, joinShopRoom, SOCKET_EVENTS } from '@/lib/socket';
import type { Order, OrderStatus } from '@/lib/types';
import { Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Tabs, useToast } from '@/components/ui';
import { OrderCard, OrderCardSkeleton, type OrderAction } from '@/components/orders/OrderCard';
import { ReasonModal } from '@/components/orders/ReasonModal';
import { NewOrderBanner } from '@/components/orders/NewOrderBanner';
import { useNewOrderAlert } from '@/components/orders/useNewOrderAlert';
import { remainingMs } from '@/components/orders/countdown';

type Tab = 'new' | 'active' | 'done';

const TAB_STATUSES: Record<Tab, OrderStatus[]> = {
  new: ['new'],
  active: ['accepted', 'on_the_way'],
  done: ['delivered', 'cancelled'],
};

const POLL_MS = 5000;

function sortOrders(list: Order[]): Order[] {
  return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function upsert(list: Order[], order: Order): Order[] {
  const idx = list.findIndex((o) => o.id === order.id);
  if (idx === -1) return sortOrders([order, ...list]);
  const next = list.slice();
  next[idx] = { ...next[idx], ...order };
  return next;
}

export default function OrdersPage() {
  const toast = useToast();
  const orderAlert = useNewOrderAlert();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('new');
  const [socketOn, setSocketOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [acting, setActing] = useState<Record<string, OrderAction>>({});
  const [reasonFor, setReasonFor] = useState<{ order: Order; kind: 'reject' | 'cancel' } | null>(null);
  const [cashConfirm, setCashConfirm] = useState<Order | null>(null);

  /** Ids we have already seen (new ones found by polling trigger the alert). */
  const knownIdsRef = useRef<Set<string> | null>(null);
  /** 'new' orders whose countdown already hit zero, so we refetch only once each. */
  const expiredRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);

  const shopId = useMemo(() => api.getUser()?.shopId ?? null, []);

  // ---------- Data ----------
  const applyOrders = useCallback(
    (list: Order[], detectNew: boolean) => {
      const sorted = sortOrders(list);
      if (detectNew && knownIdsRef.current) {
        const fresh = sorted.filter((o) => o.status === 'new' && !knownIdsRef.current!.has(o.id));
        fresh.forEach((o) => orderAlert.trigger(o));
      }
      knownIdsRef.current = new Set(sorted.map((o) => o.id));
      // Pending alerts whose order is no longer 'new' (acted on elsewhere / auto-cancelled) stop ringing.
      orderAlert.pending.forEach((p) => {
        const o = sorted.find((x) => x.id === p.id);
        if (!o || o.status !== 'new') orderAlert.acknowledgeOrder(p.id);
      });
      setOrders(sorted);
    },
    [orderAlert],
  );

  const refetch = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!opts.silent) setRefreshing(true);
      try {
        const res = await api.getOrders({ limit: 100 });
        applyOrders(res.data, true);
        setError(null);
      } catch (e) {
        // A background poll failing should not wipe an already-loaded board.
        if (knownIdsRef.current === null) setError(errorMessage(e));
        else if (!opts.silent) toast.error('Yangilab bo\'lmadi', errorMessage(e));
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        if (!opts.silent) setRefreshing(false);
      }
    },
    [applyOrders, toast],
  );

  useEffect(() => {
    void refetch({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling fallback - sockets can silently drop.
  useInterval(() => void refetch({ silent: true }), POLL_MS);

  // ---------- Realtime ----------
  useEffect(() => {
    const s = getSocket();
    if (shopId) joinShopRoom(shopId);

    const onConnect = () => {
      setSocketOn(true);
      if (shopId) joinShopRoom(shopId);
      void refetch({ silent: true });
    };
    const onDisconnect = () => setSocketOn(false);
    const onNew = (payload: Order | undefined) => {
      if (payload && typeof payload === 'object' && payload.id) {
        setOrders((xs) => upsert(xs, { ...payload, status: payload.status ?? 'new' }));
        knownIdsRef.current?.add(payload.id);
        orderAlert.trigger(payload);
      }
      void refetch({ silent: true });
    };
    const onChanged = () => void refetch({ silent: true });

    setSocketOn(s.connected);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on(SOCKET_EVENTS.ORDER_NEW, onNew);
    s.on(SOCKET_EVENTS.ORDER_CANCELLED, onChanged);
    s.on(SOCKET_EVENTS.ORDER_STATUS, onChanged);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off(SOCKET_EVENTS.ORDER_NEW, onNew);
      s.off(SOCKET_EVENTS.ORDER_CANCELLED, onChanged);
      s.off(SOCKET_EVENTS.ORDER_STATUS, onChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  // ---------- Countdown ticker (only while there are 'new' orders) ----------
  const newOrders = useMemo(() => orders.filter((o) => o.status === 'new'), [orders]);
  const hasNew = newOrders.length > 0;
  useEffect(() => {
    if (!hasNew) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasNew]);

  // When a 'new' order's window hits zero the backend auto-cancels it; refetch once per order.
  useEffect(() => {
    if (!hasNew) return;
    let shouldRefetch = false;
    newOrders.forEach((o) => {
      if (remainingMs(o.created_at, now) <= 0 && !expiredRef.current.has(o.id)) {
        expiredRef.current.add(o.id);
        shouldRefetch = true;
      }
    });
    if (shouldRefetch) setTimeout(() => void refetch({ silent: true }), 1500);
  }, [now, hasNew, newOrders, refetch]);

  // ---------- Actions ----------
  const runAction = useCallback(
    async (order: Order, action: OrderAction, fn: () => Promise<Order>, successTitle: string) => {
      setActing((m) => ({ ...m, [order.id]: action }));
      try {
        const updated = await fn();
        if (updated && updated.id) {
          setOrders((xs) => upsert(xs, updated));
        }
        orderAlert.acknowledgeOrder(order.id);
        toast.success(successTitle);
        void refetch({ silent: true });
        return true;
      } catch (e) {
        toast.error('Amal bajarilmadi', errorMessage(e));
        void refetch({ silent: true });
        return false;
      } finally {
        setActing((m) => {
          const { [order.id]: _omit, ...rest } = m;
          return rest;
        });
      }
    },
    [orderAlert, refetch, toast],
  );

  const accept = (order: Order) => void runAction(order, 'accept', () => api.acceptOrder(order.id), 'Buyurtma qabul qilindi');
  const startDelivery = (order: Order) =>
    void runAction(order, 'on_the_way', () => api.updateOrderStatus(order.id, 'on_the_way'), 'Buyurtma yo\'lga chiqdi');
  const deliver = (order: Order) => {
    if (order.payment_method === 'cash') {
      setCashConfirm(order);
      return;
    }
    void runAction(order, 'deliver', () => api.updateOrderStatus(order.id, 'delivered'), 'Buyurtma yetkazildi');
  };
  const confirmCash = async () => {
    const order = cashConfirm;
    if (!order) return;
    const ok = await runAction(order, 'deliver', () => api.updateOrderStatus(order.id, 'delivered'), 'Buyurtma yetkazildi');
    if (ok) setCashConfirm(null);
  };
  const submitReason = async (reason: string) => {
    const ctx = reasonFor;
    if (!ctx) return;
    const ok =
      ctx.kind === 'reject'
        ? await runAction(ctx.order, 'reject', () => api.rejectOrder(ctx.order.id, reason), 'Buyurtma rad etildi')
        : await runAction(ctx.order, 'cancel', () => api.cancelOrder(ctx.order.id, reason), 'Buyurtma bekor qilindi');
    if (ok) setReasonFor(null);
  };

  // ---------- Derived ----------
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { new: 0, active: 0, done: 0 };
    orders.forEach((o) => {
      if (TAB_STATUSES.new.includes(o.status)) c.new++;
      else if (TAB_STATUSES.active.includes(o.status)) c.active++;
      else if (TAB_STATUSES.done.includes(o.status)) c.done++;
    });
    return c;
  }, [orders]);

  const visible = useMemo(() => orders.filter((o) => TAB_STATUSES[tab].includes(o.status)), [orders, tab]);

  const reasonLoading = !!reasonFor && (acting[reasonFor.order.id] === 'reject' || acting[reasonFor.order.id] === 'cancel');
  const cashLoading = !!cashConfirm && acting[cashConfirm.id] === 'deliver';

  const emptyCopy: Record<Tab, { icon: React.ReactNode; title: string; description: string }> = {
    new: { icon: <Inbox className="h-6 w-6" />, title: 'Yangi buyurtmalar yo\'q', description: 'Yangi buyurtma kelganda bu yerda paydo bo\'ladi va ovozli signal beradi.' },
    active: { icon: <Clock className="h-6 w-6" />, title: 'Jarayondagi buyurtmalar yo\'q', description: 'Qabul qilingan va yo\'ldagi buyurtmalar bu yerda ko\'rsatiladi.' },
    done: { icon: <CheckCircle2 className="h-6 w-6" />, title: 'Tugallangan buyurtmalar yo\'q', description: 'Yetkazilgan va bekor qilingan buyurtmalar bu yerda ko\'rsatiladi.' },
  };

  return (
    <div>
      <NewOrderBanner
        pending={orderAlert.pending}
        onClick={() => {
          orderAlert.acknowledge();
          setTab('new');
        }}
      />

      <PageHeader
        title="Buyurtmalar"
        description="Yangi buyurtmalarni 10 daqiqa ichida qabul qiling, aks holda ular avtomatik bekor qilinadi."
        actions={
          <>
            <span
              className={
                socketOn
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20'
                  : 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20'
              }
              title={socketOn ? 'Jonli ulanish faol' : 'Jonli ulanish yo\'q - har 5 soniyada yangilanadi'}
            >
              {socketOn ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {socketOn ? 'Jonli' : 'Oflayn'}
            </span>
            {orderAlert.permission === 'default' && (
              <Button variant="secondary" size="sm" icon={<Bell className="h-3.5 w-3.5" />} onClick={() => void orderAlert.requestPermission()}>
                Bildirishnomalarni yoqish
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              loading={refreshing}
              onClick={() => void refetch()}
            >
              Yangilash
            </Button>
          </>
        }
      />

      <div className="mb-5 border-b border-slate-200">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'new', label: 'Yangi', count: counts.new },
            { value: 'active', label: 'Jarayonda', count: counts.active },
            { value: 'done', label: 'Tugallangan', count: counts.done },
          ]}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <ErrorState message={error} onRetry={() => void refetch()} />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <EmptyState icon={emptyCopy[tab].icon} title={emptyCopy[tab].title} description={emptyCopy[tab].description} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              now={now}
              acting={acting[o.id] ?? null}
              onAccept={accept}
              onReject={(order) => setReasonFor({ order, kind: 'reject' })}
              onStartDelivery={startDelivery}
              onCancel={(order) => setReasonFor({ order, kind: 'cancel' })}
              onDeliver={deliver}
            />
          ))}
        </div>
      )}

      <ReasonModal
        open={!!reasonFor}
        onClose={() => setReasonFor(null)}
        onSubmit={submitReason}
        loading={reasonLoading}
        title={reasonFor?.kind === 'reject' ? 'Buyurtmani rad etish' : 'Buyurtmani bekor qilish'}
        description={reasonFor ? `${shortId(reasonFor.order.id)} - sababni ko'rsating` : undefined}
        confirmLabel={reasonFor?.kind === 'reject' ? 'Rad etish' : 'Bekor qilish'}
      />

      <ConfirmDialog
        open={!!cashConfirm}
        onClose={() => setCashConfirm(null)}
        onConfirm={() => void confirmCash()}
        loading={cashLoading}
        tone="primary"
        title="Naqd pulni tasdiqlash"
        message={cashConfirm ? `Mijozdan ${formatMoney(cashConfirm.total_amount)} naqd pul qabul qilindimi?` : undefined}
        confirmLabel="Ha, qabul qilindi"
        cancelLabel="Yo'q"
      />
    </div>
  );
}
