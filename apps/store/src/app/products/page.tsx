'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Product } from '@/lib/types';
import { cn, formatMoney, formatNumber } from '@/lib/format';
import { useDebounce } from '@/lib/hooks';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
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
import { ProductImage } from '@/components/products/ProductImage';
import { ProductFormModal } from '@/components/products/ProductFormModal';

function matches(p: Product, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [p.name_uz, p.name_ru, p.name_en].some((n) => (n ?? '').toLowerCase().includes(needle));
}

export default function ProductsPage() {
  const toast = useToast();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const dq = useDebounce(q.trim());

  const [toggling, setToggling] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getProducts();
      setProducts(list);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => (products ?? []).filter((p) => matches(p, dq)), [products, dq]);

  const patchRow = (id: string, patch: Partial<Product>) =>
    setProducts((list) => (list ? list.map((p) => (p.id === id ? { ...p, ...patch } : p)) : list));

  const toggleAvailable = async (p: Product, value: boolean) => {
    setToggling(p.id);
    patchRow(p.id, { is_available: value });
    try {
      const updated = await api.updateProduct(p.id, { is_available: value });
      patchRow(p.id, { is_available: updated?.is_available ?? value });
      toast.success(value ? 'Mahsulot sotuvga qo\'yildi' : 'Mahsulot sotuvdan olindi', p.name_uz);
    } catch (e) {
      patchRow(p.id, { is_available: !value });
      toast.error("Holatni o'zgartirib bo'lmadi", errorMessage(e));
    } finally {
      setToggling(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const onSaved = (saved: Product, mode: 'create' | 'edit') => {
    setProducts((list) => {
      if (!list) return [saved];
      if (mode === 'create') return [saved, ...list];
      return list.map((p) => (p.id === saved.id ? saved : p));
    });
    closeForm();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleteBusy(true);
    try {
      await api.deleteProduct(target.id);
      setProducts((list) => (list ? list.filter((p) => p.id !== target.id) : list));
      toast.success("Mahsulot o'chirildi", target.name_uz);
      setDeleting(null);
    } catch (e) {
      toast.error("O'chirib bo'lmadi", errorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  const total = products?.length ?? 0;
  const isSearching = dq.length > 0;

  return (
    <div>
      <PageHeader
        title="Mahsulotlar"
        description={products ? `${formatNumber(total)} ta mahsulot` : "Do'koningizdagi mahsulotlar, narxlar va qoldiqlar"}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Yangi mahsulot
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={q} onChange={setQ} placeholder="Mahsulot nomi bo'yicha qidirish" className="sm:w-80" />
          {isSearching && products && (
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">{formatNumber(rows.length)}</span> / {formatNumber(total)} ta topildi
            </p>
          )}
        </div>

        {error && !products ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
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
              {loading && !products ? (
                <TableSkeleton rows={8} cols={6} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<Package className="h-6 w-6" />}
                      title={isSearching ? 'Mahsulot topilmadi' : 'Hali mahsulot yo\'q'}
                      description={
                        isSearching
                          ? "Qidiruv so'zini o'zgartirib ko'ring."
                          : "Birinchi mahsulotingizni qo'shing — u darhol mijozlarga ko'rinadi."
                      }
                      action={
                        !isSearching ? (
                          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                            Yangi mahsulot
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => setQ('')}>
                            Qidiruvni tozalash
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
                  const out = (p.stock ?? 0) <= 0;
                  return (
                    <TR key={p.id} className={cn(loading && 'opacity-60', !p.is_available && 'bg-slate-50/40')}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <ProductImage src={p.image_url} alt={p.name_uz} />
                          <div className="min-w-0">
                            <p className={cn('max-w-[280px] truncate font-medium', p.is_available ? 'text-slate-900' : 'text-slate-500')}>
                              {p.name_uz}
                            </p>
                            {p.name_ru && <p className="max-w-[280px] truncate text-xs text-slate-400">{p.name_ru}</p>}
                          </div>
                        </div>
                      </TD>
                      <TD>
                        {p.category?.name_uz ? (
                          <Badge tone="gray">{p.category.name_uz}</Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TD>
                      <TD align="right" className="font-medium tabular-nums text-slate-900">
                        {formatMoney(p.price)}
                      </TD>
                      <TD align="right" className={cn('tabular-nums', out ? 'font-semibold text-rose-600' : 'text-slate-700')}>
                        {out ? 'Tugagan' : formatNumber(p.stock)}
                      </TD>
                      <TD align="center">
                        <Switch
                          size="sm"
                          checked={p.is_available}
                          disabled={toggling === p.id}
                          onChange={(v) => toggleAvailable(p, v)}
                          label={p.is_available ? 'Sotuvdan olish' : "Sotuvga qo'yish"}
                        />
                      </TD>
                      <TD align="right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Tahrirlash" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="O'chirish"
                            className="hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        )}
      </Card>

      <ProductFormModal open={formOpen} product={editing} onClose={closeForm} onSaved={onSaved} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => !deleteBusy && setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        title="Mahsulotni o'chirish"
        message={
          deleting ? (
            <>
              <b>{deleting.name_uz}</b> mahsuloti o'chiriladi va mijozlarga ko'rinmaydi. Bu amalni qaytarib bo'lmaydi.
            </>
          ) : undefined
        }
        confirmLabel="O'chirish"
      />
    </div>
  );
}
