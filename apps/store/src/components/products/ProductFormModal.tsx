'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { api, errorMessage, resolveMediaUrl } from '@/lib/api';
import type { Category, Product, ProductPayload } from '@/lib/types';
import { somToTiyin, tiyinToSom } from '@/lib/format';
import { cropToSquare } from '@/lib/crop-image';
import { Button, Field, Input, Modal, Select, Switch, Textarea, useToast } from '@/components/ui';
import { ProductImage } from './ProductImage';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface FormState {
  name_uz: string;
  name_ru: string;
  name_en: string;
  category_id: string;
  description_uz: string;
  /** In so'm, as typed. Converted with somToTiyin on save. */
  price: string;
  stock: string;
  is_available: boolean;
  /** Server-relative upload path or absolute URL. */
  image_url: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const blank = (): FormState => ({
  name_uz: '',
  name_ru: '',
  name_en: '',
  category_id: '',
  description_uz: '',
  price: '',
  stock: '0',
  is_available: true,
  image_url: '',
});

const fromProduct = (p: Product): FormState => ({
  name_uz: p.name_uz ?? '',
  name_ru: p.name_ru ?? '',
  name_en: p.name_en ?? '',
  category_id: p.category_id ?? p.category?.id ?? '',
  description_uz: p.description_uz ?? '',
  price: tiyinToSom(p.price),
  stock: String(p.stock ?? 0),
  is_available: !!p.is_available,
  image_url: p.image_url ?? '',
});

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.name_uz.trim()) e.name_uz = 'Mahsulot nomini kiriting';
  if (!f.category_id) e.category_id = 'Kategoriyani tanlang';

  const priceRaw = f.price.replace(/\s/g, '').replace(',', '.');
  const som = Number(priceRaw);
  if (priceRaw === '' || !Number.isFinite(som) || som <= 0) e.price = "Narx 0 dan katta bo'lishi kerak";

  const stockRaw = f.stock.replace(/\s/g, '');
  if (!/^\d+$/.test(stockRaw)) e.stock = "Qoldiq 0 yoki undan katta butun son bo'lishi kerak";
  return e;
}

/** "Ota kategoriya › Bola" when the category has a parent, so same-named children stay distinguishable. */
function categoryLabel(c: Category, byId: Map<string, Category>): string {
  const parent = c.parent_id ? byId.get(c.parent_id) : null;
  return parent ? `${parent.name_uz} › ${c.name_uz}` : c.name_uz;
}

/**
 * Create + edit in one modal. `product === null` creates, otherwise edits.
 * Categories are fetched on first open and cached for the component's lifetime.
 */
export function ProductFormModal({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product, mode: 'create' | 'edit') => void;
}) {
  const toast = useToast();
  const isEdit = !!product;

  const [f, setF] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const list = await api.getCategories();
      setCategories(list);
    } catch (e) {
      setCatError(errorMessage(e));
    } finally {
      setCatLoading(false);
    }
  }, []);

  // Reset the form each time the modal opens (for the given product).
  useEffect(() => {
    if (!open) return;
    setF(product ? fromProduct(product) : blank());
    setErrors({});
    setLocalPreview(null);
    setUploading(false);
    if (!categories && !catLoading) void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const byId = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const sortedCategories = useMemo(() => {
    const list = categories ?? [];
    return [...list].sort((a, b) => categoryLabel(a, byId).localeCompare(categoryLabel(b, byId)));
  }, [categories, byId]);

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setF((p) => ({ ...p, [k]: value }));
      if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
    };

  const pickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later.
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setErrors((p) => ({ ...p, image_url: 'Faqat JPG, PNG yoki WEBP formatdagi rasm yuklash mumkin' }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((p) => ({ ...p, image_url: 'Rasm hajmi 5 MB dan oshmasligi kerak' }));
      return;
    }
    setErrors((p) => ({ ...p, image_url: undefined }));
    setUploading(true);

    let preview: string | null = null;
    try {
      // Auto center-crop to clean 1:1 square
      const croppedFile = await cropToSquare(file);
      preview = URL.createObjectURL(croppedFile);
      setLocalPreview(preview);

      const url = await api.uploadImage(croppedFile);
      setF((p) => ({ ...p, image_url: url }));
    } catch (err) {
      toast.error('Rasm yuklanmadi', errorMessage(err));
    } finally {
      setUploading(false);
      setLocalPreview(null);
      if (preview) URL.revokeObjectURL(preview);
    }
  };

  const removeImage = () => {
    setF((p) => ({ ...p, image_url: '' }));
    setErrors((p) => ({ ...p, image_url: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) {
      setErrors((p) => ({ ...p, image_url: 'Rasm yuklanishini kuting' }));
      return;
    }
    const errs = validate(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload: ProductPayload = {
      name_uz: f.name_uz.trim(),
      name_ru: f.name_ru.trim() || undefined,
      name_en: f.name_en.trim() || undefined,
      category_id: f.category_id,
      description_uz: f.description_uz.trim() || (isEdit ? null : undefined),
      price: somToTiyin(f.price.replace(',', '.')),
      stock: Number(f.stock.replace(/\s/g, '')),
      is_available: f.is_available,
      image_url: f.image_url.trim() || null,
    };

    setSaving(true);
    try {
      const saved = isEdit && product ? await api.updateProduct(product.id, payload) : await api.createProduct(payload);
      // Backend may return the row without the relation; attach the category we already know.
      const category = saved.category ?? byId.get(saved.category_id ?? payload.category_id) ?? product?.category ?? null;
      const merged: Product = { ...(product ?? ({} as Product)), ...saved, category };
      toast.success(isEdit ? "O'zgarishlar saqlandi" : "Mahsulot qo'shildi", merged.name_uz);
      onSaved(merged, isEdit ? 'edit' : 'create');
    } catch (err) {
      toast.error(isEdit ? "Saqlab bo'lmadi" : "Mahsulotni qo'shib bo'lmadi", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading;
  const previewSrc = localPreview ?? resolveMediaUrl(f.image_url);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="lg"
      title={isEdit ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
      description={isEdit ? product?.name_uz : "Do'koningiz uchun yangi mahsulot qo'shish"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor
          </Button>
          <Button type="submit" form="product-form" loading={saving} disabled={uploading}>
            {isEdit ? 'Saqlash' : "Qo'shish"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-5" noValidate>
        {/* Image */}
        <Field label="Rasm" error={errors.image_url} hint={!errors.image_url ? 'JPG, PNG yoki WEBP, 5 MB gacha' : undefined}>
          <div className="flex items-center gap-4">
            <div className="relative">
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-lg bg-slate-100 object-cover ring-1 ring-slate-200"
                />
              ) : (
                <ProductImage src={null} size="lg" />
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFileChange}
                disabled={busy}
              />
              <Button variant="secondary" size="sm" icon={<ImagePlus className="h-4 w-4" />} onClick={pickFile} disabled={busy}>
                {f.image_url ? "Rasmni o'zgartirish" : 'Rasm tanlash'}
              </Button>
              {f.image_url && !uploading && (
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={removeImage} disabled={busy}>
                  Rasmni olib tashlash
                </Button>
              )}
            </div>
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nomi (o'zbekcha)" required error={errors.name_uz} htmlFor="p-name-uz" className="sm:col-span-2">
            <Input
              id="p-name-uz"
              value={f.name_uz}
              onChange={set('name_uz')}
              invalid={!!errors.name_uz}
              placeholder="Masalan: Non, 1 dona"
              maxLength={200}
              autoFocus
            />
          </Field>
          <Field label="Nomi (ruscha)" htmlFor="p-name-ru">
            <Input id="p-name-ru" value={f.name_ru} onChange={set('name_ru')} placeholder="Например: Хлеб, 1 шт" maxLength={200} />
          </Field>
          <Field label="Nomi (inglizcha)" htmlFor="p-name-en">
            <Input id="p-name-en" value={f.name_en} onChange={set('name_en')} placeholder="For example: Bread, 1 pc" maxLength={200} />
          </Field>

          <Field
            label="Kategoriya"
            required
            htmlFor="p-category"
            error={errors.category_id ?? (catError ? `Kategoriyalar yuklanmadi: ${catError}` : null)}
            className="sm:col-span-2"
          >
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  id="p-category"
                  value={f.category_id}
                  onChange={set('category_id')}
                  invalid={!!errors.category_id}
                  disabled={catLoading || !!catError}
                >
                  <option value="">{catLoading ? 'Yuklanmoqda...' : 'Kategoriyani tanlang'}</option>
                  {sortedCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryLabel(c, byId)}
                    </option>
                  ))}
                </Select>
              </div>
              {catError && (
                <Button
                  variant="secondary"
                  size="icon"
                  title="Qayta yuklash"
                  onClick={() => void loadCategories()}
                  loading={catLoading}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Field>

          <Field label="Narx" required error={errors.price} htmlFor="p-price" hint={!errors.price ? "So'mda kiriting" : undefined}>
            <Input
              id="p-price"
              value={f.price}
              onChange={set('price')}
              invalid={!!errors.price}
              inputMode="decimal"
              placeholder="12 000"
              rightAddon="so'm"
            />
          </Field>
          <Field label="Qoldiq" required error={errors.stock} htmlFor="p-stock" hint={!errors.stock ? 'Omborda nechta bor' : undefined}>
            <Input
              id="p-stock"
              type="number"
              min={0}
              step={1}
              value={f.stock}
              onChange={set('stock')}
              invalid={!!errors.stock}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>

          <Field label="Tavsif (o'zbekcha)" htmlFor="p-desc-uz" className="sm:col-span-2">
            <Textarea
              id="p-desc-uz"
              value={f.description_uz}
              onChange={set('description_uz')}
              placeholder="Mahsulot haqida qisqacha ma'lumot"
              maxLength={2000}
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 sm:col-span-2">
            <div>
              <p className="text-sm font-medium text-slate-900">Sotuvda</p>
              <p className="text-xs text-slate-500">O'chirilsa mahsulot mijozlarga ko'rinmaydi</p>
            </div>
            <Switch
              checked={f.is_available}
              onChange={(v) => setF((p) => ({ ...p, is_available: v }))}
              label="Sotuvda"
              disabled={busy}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
