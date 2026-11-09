'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudDownload, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Category, Product } from '@/lib/types';
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
  Pagination,
  SearchInput,
  Select,
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
import { ProductImage } from '@/components/products/ProductImage';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { PosImportModal } from '@/components/products/PosImportModal';

const PAGE_LIMIT = 50;
type StockFilter = 'all' | 'available' | 'out_of_stock' | 'hidden';

/** Name in any language, barcode or SKU — a scanner typing a barcode + Enter lands on exactly one row. */
function matches(p: Product, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [p.name_uz, p.name_ru, p.name_en, p.barcode, p.sku].some((n) => (n ?? '').toLowerCase().includes(needle));
}

export default function ProductsPage() {
  const toast = useToast();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const dq = useDebounce(q.trim());
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [toggling, setToggling] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [posImportOpen, setPosImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cats] = await Promise.all([api.getProducts(), api.getCategories().catch(() => [] as Category[])]);
      setProducts(list);
      setCategories(cats);
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

  const counts = useMemo(() => {
    const list = products ?? [];
    let available = 0;
    let outOfStock = 0;
    let hidden = 0;
    for (const p of list) {
      if ((p.stock ?? 0) <= 0) outOfStock++;
      if (!p.is_available) hidden++;
      if (p.is_available && (p.stock ?? 0) > 0) available++;
    }
    return { all: list.length, available, out_of_stock: outOfStock, hidden };
  }, [products]);

  const rows = useMemo(() => {
    return (products ?? []).filter((p) => {
      if (!matches(p, dq)) return false;
      if (categoryFilter && p.category_id !== categoryFilter && p.category?.id !== categoryFilter) return false;
      if (stockFilter === 'available') return p.is_available && (p.stock ?? 0) > 0;
      if (stockFilter === 'out_of_stock') return (p.stock ?? 0) <= 0;
      if (stockFilter === 'hidden') return !p.is_available;
      return true;
    });
  }, [products, dq, categoryFilter, stockFilter]);

  useEffect(() => {
    setPage(1);
  }, [dq, categoryFilter, stockFilter]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_LIMIT;
    return rows.slice(start, start + PAGE_LIMIT);
  }, [rows, page]);

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
  const isSearching = dq.length > 0 || stockFilter !== 'all' || !!categoryFilter;

  return (
    <div>
      <PageHeader
        title="Mahsulotlar"
        description={products ? `${formatNumber(total)} ta mahsulot` : "Do'koningizdagi mahsulotlar, narxlar va qoldiqlar"}
        actions={
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Button
              variant="secondary"
              icon={<CloudDownload className="h-4 w-4 text-emerald-600" />}
              onClick={() => setPosImportOpen(true)}
            >
              REGOS / POS dan yuklash
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Yangi mahsulot
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-3 pt-2">
          <Tabs<StockFilter>
            value={stockFilter}
            onChange={setStockFilter}
            items={[
              { value: 'all', label: 'Hammasi', count: products ? counts.all : null },
              { value: 'available', label: 'Sotuvda', count: products ? counts.available : null },
              { value: 'out_of_stock', label: 'Tugagan', count: products ? counts.out_of_stock : null },
              { value: 'hidden', label: 'Yashirilgan', count: products ? counts.hidden : null },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Nomi, shtrix-kod yoki SKU bo'yicha qidirish" className="w-full sm:w-80" />
            {categories.length > 0 && (
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Kategoriya bo'yicha filtrlash"
                className="w-full sm:w-56"
              >
                <option value="">Barcha kategoriyalar</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_uz}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {isSearching && products && (
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">{formatNumber(rows.length)}</span> / {formatNumber(total)} ta topildi
            </p>
          )}
        </div>

        {error && !products ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* Mobile Card List (< md) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {loading && !products ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={<Package className="h-6 w-6" />}
                  title={isSearching ? 'Mahsulot topilmadi' : "Hali mahsulot yo'q"}
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
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setQ('');
                          setStockFilter('all');
                          setCategoryFilter('');
                        }}
                      >
                        Filtrlarni tozalash
                      </Button>
                    )
                  }
                />
              ) : (
                pagedRows.map((p) => {
                  const out = (p.stock ?? 0) <= 0;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex flex-col gap-3 p-3.5 transition-colors',
                        loading && 'opacity-60',
                        !p.is_available && 'bg-slate-50/60',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <ProductImage src={p.image_url} alt={p.name_uz} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('line-clamp-2 text-sm font-semibold leading-snug', p.is_available ? 'text-slate-900' : 'text-slate-500')}>
                              {p.name_uz}
                            </p>
                            <Switch
                              size="sm"
                              checked={p.is_available}
                              disabled={toggling === p.id}
                              onChange={(v) => toggleAvailable(p, v)}
                              label={p.is_available ? 'Sotuvdan olish' : "Sotuvga qo'yish"}
                            />
                          </div>
                          {p.name_ru && <p className="mt-0.5 truncate text-xs text-slate-400">{p.name_ru}</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {p.category?.name_uz && <Badge tone="gray">{p.category.name_uz}</Badge>}
                            {(p.barcode || p.sku) && (
                              <span className="truncate font-mono text-[11px] text-slate-400">
                                {[p.barcode, p.sku].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm font-bold tabular-nums text-slate-900">{formatMoney(p.price)}</span>
                          <span className={cn('text-xs tabular-nums', out ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                            {out ? 'Tugagan' : `Qoldiq: ${formatNumber(p.stock)}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(p)}>
                            Tahrirlash
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="O'chirish"
                            className="text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table (md+) */}
            <Table className="hidden md:block">
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
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setQ('');
                              setStockFilter('all');
                              setCategoryFilter('');
                            }}
                          >
                            Filtrlarni tozalash
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              ) : (
                pagedRows.map((p) => {
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
                            {(p.barcode || p.sku) && (
                              <p className="max-w-[280px] truncate font-mono text-[11px] text-slate-400" title="Shtrix-kod · SKU">
                                {[p.barcode, p.sku].filter(Boolean).join(' · ')}
                              </p>
                            )}
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
          {rows.length > PAGE_LIMIT && (
            <Pagination page={page} limit={PAGE_LIMIT} total={rows.length} onChange={setPage} />
          )}
          </>
        )}
      </Card>

      <ProductFormModal open={formOpen} product={editing} onClose={closeForm} onSaved={onSaved} />

      <PosImportModal
        open={posImportOpen}
        onClose={() => setPosImportOpen(false)}
        onImported={() => {
          void load();
        }}
      />

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
