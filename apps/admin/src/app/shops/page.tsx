'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronRight, Pencil, Plus, ShieldOff, Store } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Paginated, Shop } from '@/lib/types';
import { formatMoney, formatNumber } from '@/lib/format';
import { useDebounce } from '@/lib/hooks';
import { SHOP_STATUS_META } from '@/lib/constants';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Switch,
  Table,
  TableSkeleton,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { ShopLogo } from '@/components/shops/ShopLogo';
import { CreateShopModal, CredentialsModal, Credentials, EditShopModal } from '@/components/shops/ShopForms';

const LIMIT = 20;
type StatusFilter = 'all' | 'pending' | 'active' | 'blocked';

function ShopsInner() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const dq = useDebounce(q.trim());
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Shop> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(params?.get('new') === '1');
  const [editing, setEditing] = useState<Shop | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const r = await api.getShops({ q: dq || undefined, status: status === 'all' ? undefined : status, page, limit: LIMIT });
      if (my !== seq.current) return;
      setResult(r);
      setError(null);
    } catch (e) {
      if (my === seq.current) setError(errorMessage(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [dq, status, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPage(1), [dq, status]);

  const patchRow = (id: string, patch: Partial<Shop>) =>
    setResult((r) => (r ? { ...r, data: r.data.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : r));

  const toggleActive = async (shop: Shop, value: boolean) => {
    setToggling(shop.id);
    patchRow(shop.id, { is_active: value });
    try {
      await api.updateShop(shop.id, { is_active: value });
      toast.success(value ? "Do'kon faollashtirildi" : "Do'kon o'chirildi", shop.name);
    } catch (e) {
      patchRow(shop.id, { is_active: !value });
      toast.error("Holatni o'zgartirib bo'lmadi", errorMessage(e));
    } finally {
      setToggling(null);
    }
  };

  const approve = async (shop: Shop) => {
    setToggling(shop.id);
    try {
      const updated = await api.approveShop(shop.id);
      patchRow(shop.id, updated);
      toast.success("Do'kon tasdiqlandi", `${shop.name} endi mijozlarga ko'rinadi`);
    } catch (e) {
      toast.error("Tasdiqlab bo'lmadi", errorMessage(e));
    } finally {
      setToggling(null);
    }
  };

  const block = async (shop: Shop) => {
    setToggling(shop.id);
    try {
      const updated = await api.blockShop(shop.id);
      patchRow(shop.id, updated);
      toast.success("Do'kon bloklandi", shop.name);
    } catch (e) {
      toast.error("Bloklab bo'lmadi", errorMessage(e));
    } finally {
      setToggling(null);
    }
  };

  const unblock = async (shop: Shop) => {
    setToggling(shop.id);
    try {
      const updated = await api.unblockShop(shop.id);
      patchRow(shop.id, updated);
      toast.success("Blokdan chiqarildi", shop.name);
    } catch (e) {
      toast.error("Blokdan chiqarib bo'lmadi", errorMessage(e));
    } finally {
      setToggling(null);
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    if (params?.get('new')) router.replace('/shops');
  };

  const rows = result?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Do'konlar"
        description="Hamkor do'konlar, ularning egalari va ko'rsatkichlari"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Yangi do'kon
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <Tabs<StatusFilter>
            items={[
              { value: 'all', label: 'Hammasi' },
              { value: 'pending', label: 'Tasdiqlash kutilmoqda' },
              { value: 'active', label: 'Faol' },
              { value: 'blocked', label: 'Bloklangan' },
            ]}
            value={status}
            onChange={setStatus}
          />
          <SearchInput value={q} onChange={setQ} placeholder="Nomi, telefon yoki manzil" className="mb-3 sm:w-72" />
        </div>

        {error && !result ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Do'kon</TH>
                <TH>Egasi</TH>
                <TH>Holat</TH>
                <TH align="right">Mahsulot</TH>
                <TH align="right">Buyurtma</TH>
                <TH align="right">Tushum</TH>
                <TH align="center">Faol</TH>
                <TH />
              </THead>
              <TBody>
                {loading && !result ? (
                  <TableSkeleton rows={8} cols={8} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={<Store className="h-6 w-6" />}
                        title="Do'konlar topilmadi"
                        description={q || status !== 'all' ? "Qidiruv yoki filtrni o'zgartiring." : "Birinchi do'konni qo'shing."}
                        action={
                          !q && status === 'all' ? (
                            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                              Yangi do'kon
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((s) => (
                    <TR key={s.id} onClick={() => router.push(`/shops/${s.id}`)} className={loading ? 'opacity-60' : undefined}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <ShopLogo shop={s} />
                          <div className="min-w-0">
                            <p className="max-w-[240px] truncate font-medium text-slate-900">{s.name}</p>
                            <p className="max-w-[240px] truncate text-xs text-slate-400">{s.address_text}</p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <p className="text-slate-900">{s.owner?.name || '—'}</p>
                        <p className="font-mono text-xs text-slate-400">
                          {s.owner?.login ? `@${s.owner.login}` : ''}
                          {s.owner?.is_blocked && <span className="ml-1 font-sans text-rose-500">· bloklangan</span>}
                        </p>
                      </TD>
                      <TD>
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={SHOP_STATUS_META[s.status].tone} dot>
                            {SHOP_STATUS_META[s.status].label}
                          </Badge>
                          {s.status === 'active' && (
                            <Badge tone={s.isCurrentlyOpen ? 'green' : 'amber'} dot>
                              {s.isCurrentlyOpen ? 'Hozir ochiq' : 'Yopiq'}
                            </Badge>
                          )}
                          <span className="text-xs text-slate-400">
                            {s.open_time}–{s.close_time}
                          </span>
                        </div>
                      </TD>
                      <TD align="right" className="tabular-nums">
                        {formatNumber(s.productCount)}
                      </TD>
                      <TD align="right" className="tabular-nums">
                        {formatNumber(s.orderCount)}
                      </TD>
                      <TD align="right" className="font-medium tabular-nums text-slate-900">
                        {formatMoney(s.revenueTiyin)}
                      </TD>
                      <TD align="center">
                        {s.status === 'active' ? (
                          <Switch
                            size="sm"
                            checked={s.is_active}
                            disabled={toggling === s.id}
                            onChange={(v) => toggleActive(s, v)}
                            label={s.is_active ? "O'chirish" : 'Faollashtirish'}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TD>
                      <TD align="right">
                        <div className="flex items-center justify-end gap-1">
                          {s.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                icon={<Check className="h-3.5 w-3.5" />}
                                loading={toggling === s.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  approve(s);
                                }}
                              >
                                Tasdiqlash
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<ShieldOff className="h-3.5 w-3.5" />}
                                disabled={toggling === s.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  block(s);
                                }}
                              >
                                Rad etish
                              </Button>
                            </>
                          )}
                          {s.status === 'blocked' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={toggling === s.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                unblock(s);
                              }}
                            >
                              Blokdan chiqarish
                            </Button>
                          )}
                          {s.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Bloklash"
                              onClick={(e) => {
                                e.stopPropagation();
                                block(s);
                              }}
                            >
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Tahrirlash"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(s);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Link
                            href={`/shops/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Batafsil"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
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

      <CreateShopModal
        open={createOpen}
        onClose={closeCreate}
        onCreated={(c) => {
          closeCreate();
          setCreds(c);
          load();
        }}
      />
      <EditShopModal
        shop={editing}
        onClose={() => setEditing(null)}
        onSaved={(s) => {
          patchRow(s.id, s);
          setEditing(null);
        }}
      />
      <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}

export default function ShopsPage() {
  return (
    <Suspense fallback={null}>
      <ShopsInner />
    </Suspense>
  );
}
