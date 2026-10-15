'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Banknote, Check, Clock, MapPin, Package, Pencil, Phone, ShieldOff, ShoppingBag, Trash2, User } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Product, ShopDetail } from '@/lib/types';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { SHOP_STATUS_META } from '@/lib/constants';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DescList,
  EmptyState,
  ErrorState,
  SearchInput,
  Skeleton,
  StatCard,
  Switch,
  Table,
  TableSkeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { ShopLogo } from '@/components/shops/ShopLogo';
import { CredentialsModal, Credentials, EditShopModal, ResetPasswordButton } from '@/components/shops/ShopForms';

export default function ShopDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const toast = useToast();
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [togglingShop, setTogglingShop] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      setShop(await api.getShop(id));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const setProduct = (pid: string, patch: Partial<Product> | null) =>
    setShop((s) =>
      s
        ? {
            ...s,
            products: patch === null ? s.products.filter((p) => p.id !== pid) : s.products.map((p) => (p.id === pid ? { ...p, ...patch } : p)),
          }
        : s,
    );

  const toggleAvailable = async (p: Product, v: boolean) => {
    setBusy(p.id);
    setProduct(p.id, { is_available: v });
    try {
      await api.updateProduct(p.id, { is_available: v });
      toast.success(v ? 'Mahsulot sotuvga qaytarildi' : 'Mahsulot sotuvdan olindi', p.name_uz);
    } catch (e) {
      setProduct(p.id, { is_available: !v });
      toast.error("O'zgartirib bo'lmadi", errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.deleteProduct(deleting.id);
      setProduct(deleting.id, null);
      setShop((s) => (s ? { ...s, productCount: Math.max(0, (s.productCount ?? 1) - 1) } : s));
      toast.success("Mahsulot o'chirildi", deleting.name_uz);
      setDeleting(null);
    } catch (e) {
      toast.error("O'chirib bo'lmadi", errorMessage(e));
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleShop = async (v: boolean) => {
    if (!shop) return;
    setTogglingShop(true);
    setShop({ ...shop, is_active: v });
    try {
      await api.updateShop(shop.id, { is_active: v });
      toast.success(v ? "Do'kon faollashtirildi" : "Do'kon o'chirildi");
    } catch (e) {
      setShop((s) => (s ? { ...s, is_active: !v } : s));
      toast.error("Holatni o'zgartirib bo'lmadi", errorMessage(e));
    } finally {
      setTogglingShop(false);
    }
  };

  const approve = async () => {
    if (!shop) return;
    setTogglingShop(true);
    try {
      const updated = await api.approveShop(shop.id);
      setShop((s) => (s ? { ...s, ...updated } : s));
      toast.success("Do'kon tasdiqlandi", "Endi mijozlarga ko'rinadi");
    } catch (e) {
      toast.error("Tasdiqlab bo'lmadi", errorMessage(e));
    } finally {
      setTogglingShop(false);
    }
  };

  const block = async () => {
    if (!shop) return;
    setTogglingShop(true);
    try {
      const updated = await api.blockShop(shop.id);
      setShop((s) => (s ? { ...s, ...updated } : s));
      toast.success("Do'kon bloklandi");
    } catch (e) {
      toast.error("Bloklab bo'lmadi", errorMessage(e));
    } finally {
      setTogglingShop(false);
    }
  };

  const unblock = async () => {
    if (!shop) return;
    setTogglingShop(true);
    try {
      const updated = await api.unblockShop(shop.id);
      setShop((s) => (s ? { ...s, ...updated } : s));
      toast.success('Blokdan chiqarildi');
    } catch (e) {
      toast.error("Blokdan chiqarib bo'lmadi", errorMessage(e));
    } finally {
      setTogglingShop(false);
    }
  };

  const products = useMemo(() => {
    const list = shop?.products ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) =>
      [p.name_uz, p.name_ru, p.name_en, p.category?.name_uz].some((x) => x?.toLowerCase().includes(term)),
    );
  }, [shop, q]);

  if (error && !shop) {
    return (
      <Card>
        <ErrorState message={error} onRetry={load} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/shops" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Do'konlar
      </Link>

      {/* Header */}
      <Card className="p-5">
        {!shop ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <ShopLogo shop={shop} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">{shop.name}</h1>
                <Badge tone={SHOP_STATUS_META[shop.status].tone} dot>
                  {SHOP_STATUS_META[shop.status].label}
                </Badge>
                {shop.status === 'active' && (
                  <Badge tone={shop.isCurrentlyOpen ? 'green' : 'amber'} dot>
                    {shop.isCurrentlyOpen ? 'Hozir ochiq' : 'Yopiq'}
                  </Badge>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {shop.address_text}
                </span>
                <a href={`tel:${shop.phone}`} className="flex items-center gap-1.5 hover:text-brand-700">
                  <Phone className="h-3.5 w-3.5" />
                  {shop.phone}
                </a>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {shop.open_time}–{shop.close_time}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {shop.status === 'pending' && (
                <>
                  <Button icon={<Check className="h-4 w-4" />} loading={togglingShop} onClick={approve}>
                    Tasdiqlash
                  </Button>
                  <Button variant="secondary" icon={<ShieldOff className="h-4 w-4" />} disabled={togglingShop} onClick={block}>
                    Rad etish
                  </Button>
                </>
              )}
              {shop.status === 'blocked' && (
                <Button variant="secondary" loading={togglingShop} onClick={unblock}>
                  Blokdan chiqarish
                </Button>
              )}
              {shop.status === 'active' && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    Faol
                    <Switch checked={shop.is_active} onChange={toggleShop} disabled={togglingShop} label="Faol" />
                  </label>
                  <Button variant="secondary" icon={<ShieldOff className="h-4 w-4" />} disabled={togglingShop} onClick={block}>
                    Bloklash
                  </Button>
                </>
              )}
              <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Tahrirlash
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={!shop} label="Bugungi buyurtmalar" value={formatNumber(shop?.stats.ordersToday)} icon={<ShoppingBag className="h-5 w-5" />} />
        <StatCard
          loading={!shop}
          label="30 kunlik buyurtmalar"
          value={formatNumber(shop?.stats.orders30d)}
          hint={`Jami: ${formatNumber(shop?.orderCount)} ta`}
          icon={<ShoppingBag className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          loading={!shop}
          label="30 kunlik tushum"
          value={formatMoney(shop?.stats.revenue30dTiyin)}
          hint={`Jami: ${formatMoney(shop?.revenueTiyin)}`}
          icon={<Banknote className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          loading={!shop}
          label="Mahsulotlar"
          value={formatNumber(shop?.products.length)}
          hint={`${formatNumber(shop?.products.filter((p) => p.is_available).length)} ta sotuvda`}
          icon={<Package className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-3">
        <Card className="2xl:self-start">
          <CardHeader title="Do'kon egasi" actions={shop?.owner ? <ResetPasswordButton shop={shop} onDone={setCreds} /> : undefined} />
          <div className="p-5">
            {!shop ? (
              <Skeleton className="h-32 w-full" />
            ) : !shop.owner ? (
              <EmptyState icon={<User className="h-6 w-6" />} title="Egasi biriktirilmagan" />
            ) : (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700">
                    {(shop.owner.name || shop.owner.login || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{shop.owner.name || '—'}</p>
                    <p className="font-mono text-xs text-slate-500">@{shop.owner.login}</p>
                  </div>
                </div>
                <DescList
                  items={[
                    { label: 'Telefon', value: shop.owner.phone || '—' },
                    {
                      label: 'Holat',
                      value: shop.owner.is_blocked ? <Badge tone="red">Bloklangan</Badge> : <Badge tone="green">Faol</Badge>,
                    },
                    {
                      label: 'Parol',
                      value: shop.owner.must_change_password ? (
                        <Badge tone="amber">Vaqtinchalik</Badge>
                      ) : (
                        <span className="text-slate-600">O'rnatilgan</span>
                      ),
                    },
                    { label: 'Komissiya', value: `${shop.commission_rate_percent ?? 0}%` },
                    { label: "Qo'shilgan", value: formatDate(shop.created_at) },
                  ]}
                />
              </>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden 2xl:col-span-2">
          <CardHeader
            title="Mahsulotlar"
            description="Moderatsiya: sotuvdan olish yoki o'chirish"
            actions={<SearchInput value={q} onChange={setQ} placeholder="Mahsulot qidirish" className="w-56" />}
          />
          <Table>
            <THead>
              <TH>Mahsulot</TH>
              <TH>Kategoriya</TH>
              <TH align="right">Narx</TH>
              <TH align="right">Qoldiq</TH>
              <TH align="center">Sotuvda</TH>
              <TH />
            </THead>
            <TBody>
              {!shop ? (
                <TableSkeleton rows={6} cols={6} />
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={<Package className="h-6 w-6" />} title={q ? 'Hech narsa topilmadi' : "Mahsulotlar yo'q"} />
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                        <p className={`max-w-[220px] truncate font-medium ${p.is_available ? 'text-slate-900' : 'text-slate-400'}`}>{p.name_uz}</p>
                      </div>
                    </TD>
                    <TD className="text-slate-500">{p.category?.name_uz ?? '—'}</TD>
                    <TD align="right" className="tabular-nums">
                      {formatMoney(p.price)}
                    </TD>
                    <TD align="right" className={`tabular-nums ${p.stock <= 0 ? 'text-rose-500' : ''}`}>
                      {formatNumber(p.stock)}
                    </TD>
                    <TD align="center">
                      <Switch size="sm" checked={p.is_available} disabled={busy === p.id} onChange={(v) => toggleAvailable(p, v)} label="Sotuvda" />
                    </TD>
                    <TD align="right">
                      <Button variant="ghost" size="icon" title="O'chirish" onClick={() => setDeleting(p)} className="hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </div>

      <EditShopModal
        shop={editing ? shop : null}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          load();
        }}
      />
      <CredentialsModal creds={creds} onClose={() => setCreds(null)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={deleteLoading}
        title="Mahsulotni o'chirish"
        message={
          <>
            <b>{deleting?.name_uz}</b> katalogdan o'chiriladi va mijozlarga ko'rinmaydi. Eski buyurtmalar saqlanib qoladi.
          </>
        }
        confirmLabel="O'chirish"
      />
    </div>
  );
}
