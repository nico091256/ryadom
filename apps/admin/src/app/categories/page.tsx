'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Category } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Table,
  TableSkeleton,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';

function CategoryIcon({ icon }: { icon: string | null }) {
  if (icon && /^https?:\/\//.test(icon)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
      {icon && icon.length <= 2 ? <span className="text-lg">{icon}</span> : <FolderTree className="h-4 w-4" />}
    </div>
  );
}

function CategoryModal({
  open,
  category,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ name_uz: '', name_ru: '', name_en: '', icon_url: '' });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setF({
        name_uz: category?.name_uz ?? '',
        name_ru: category?.name_ru ?? '',
        name_en: category?.name_en ?? '',
        icon_url: category?.icon_url ?? '',
      });
      setErr(null);
    }
  }, [open, category]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name_uz.trim()) {
      setErr("O'zbekcha nomini kiriting");
      return;
    }
    setSaving(true);
    const payload = {
      name_uz: f.name_uz.trim(),
      name_ru: f.name_ru.trim() || f.name_uz.trim(),
      name_en: f.name_en.trim() || f.name_uz.trim(),
      icon_url: f.icon_url.trim() || undefined,
    };
    try {
      if (category) await api.updateCategory(category.id, payload);
      else await api.createCategory(payload);
      toast.success(category ? 'Kategoriya yangilandi' : "Kategoriya qo'shildi", payload.name_uz);
      onSaved();
    } catch (e2) {
      toast.error("Saqlab bo'lmadi", errorMessage(e2));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={category ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor
          </Button>
          <Button type="submit" form="category-form" loading={saving}>
            Saqlash
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nomi (o'zbekcha)" required error={err}>
          <Input value={f.name_uz} onChange={set('name_uz')} invalid={!!err} placeholder="Meva va sabzavotlar" autoFocus />
        </Field>
        <Field label="Nomi (ruscha)" hint="Bo'sh qolsa o'zbekcha nomi ishlatiladi">
          <Input value={f.name_ru} onChange={set('name_ru')} placeholder="Овощи и фрукты" />
        </Field>
        <Field label="Nomi (inglizcha)" hint="Bo'sh qolsa o'zbekcha nomi ishlatiladi">
          <Input value={f.name_en} onChange={set('name_en')} placeholder="Fruits & Vegetables" />
        </Field>
        <Field label="Ikonka" hint="Rasm URL manzili, emoji yoki ikonka nomi">
          <div className="flex items-center gap-3">
            <CategoryIcon icon={f.icon_url.trim() || null} />
            <Input value={f.icon_url} onChange={set('icon_url')} placeholder="https://... yoki apple" className="flex-1" />
          </div>
        </Field>
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const toast = useToast();
  const [items, setItems] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [inUse, setInUse] = useState<{ category: Category; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.getCategories();
      setItems(Array.isArray(list) ? list : []);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.deleteCategory(deleting.id);
      toast.success("Kategoriya o'chirildi", deleting.name_uz);
      setItems((xs) => (xs ? xs.filter((c) => c.id !== deleting.id) : xs));
      setDeleting(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.code === 'CATEGORY_IN_USE')) {
        setInUse({ category: deleting, message: e.message });
        setDeleting(null);
      } else {
        toast.error("O'chirib bo'lmadi", errorMessage(e));
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = items ?? [];
    if (!term) return list;
    return list.filter((c) => [c.name_uz, c.name_ru, c.name_en].some((x) => x?.toLowerCase().includes(term)));
  }, [items, q]);

  return (
    <div>
      <PageHeader
        title="Kategoriyalar"
        description="Barcha do'konlar uchun umumiy mahsulot kategoriyalari"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ open: true, category: null })}>
            Yangi kategoriya
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <p className="text-sm text-slate-500">{items ? `${formatNumber(items.length)} ta kategoriya` : ' '}</p>
          <SearchInput value={q} onChange={setQ} placeholder="Kategoriya qidirish" className="w-full sm:w-72" />
        </div>
        {error && !items ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <Table>
            <THead>
              <TH>Nomi</TH>
              <TH>Ruscha</TH>
              <TH>Inglizcha</TH>
              <TH align="right">Mahsulotlar</TH>
              <TH />
            </THead>
            <TBody>
              {!items ? (
                <TableSkeleton rows={8} cols={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={<FolderTree className="h-6 w-6" />}
                      title={q ? 'Hech narsa topilmadi' : "Kategoriyalar yo'q"}
                      action={
                        !q ? (
                          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ open: true, category: null })}>
                            Kategoriya qo'shish
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <CategoryIcon icon={c.icon_url} />
                        <span className="font-medium text-slate-900">{c.name_uz}</span>
                      </div>
                    </TD>
                    <TD className="text-slate-500">{c.name_ru}</TD>
                    <TD className="text-slate-500">{c.name_en}</TD>
                    <TD align="right" className="tabular-nums">
                      {c.productCount != null ? formatNumber(c.productCount) : '—'}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Tahrirlash" onClick={() => setModal({ open: true, category: c })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="O'chirish" onClick={() => setDeleting(c)} className="hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        )}
      </Card>

      <CategoryModal
        open={modal.open}
        category={modal.category}
        onClose={() => setModal({ open: false, category: null })}
        onSaved={() => {
          setModal({ open: false, category: null });
          load();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={deleteLoading}
        title="Kategoriyani o'chirish"
        message={
          <>
            <b>{deleting?.name_uz}</b> kategoriyasi butunlay o'chiriladi.
            {deleting?.productCount ? ` Unda ${deleting.productCount} ta mahsulot bor — avval ularni boshqa kategoriyaga o'tkazing.` : ''}
          </>
        }
        confirmLabel="O'chirish"
      />
      <Modal
        open={!!inUse}
        onClose={() => setInUse(null)}
        size="sm"
        title="Kategoriya ishlatilmoqda"
        footer={<Button onClick={() => setInUse(null)}>Tushunarli</Button>}
      >
        <p className="text-sm text-slate-600">
          <b>{inUse?.category.name_uz}</b> kategoriyasini o'chirib bo'lmaydi, chunki unga mahsulotlar biriktirilgan.
        </p>
        {inUse?.message && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {/\d+/.test(inUse.message)
              ? `${/archived/i.test(inUse.message) ? 'Arxivlangan (buyurtma tarixiga ega)' : 'Faol'} mahsulotlar soni: ${inUse.message.match(/\d+/)![0]} ta.`
              : inUse.message}
          </p>
        )}
        <p className="mt-2 text-sm text-slate-500">Avval mahsulotlarni boshqa kategoriyaga o'tkazing yoki ularni o'chiring.</p>
      </Modal>
    </div>
  );
}
