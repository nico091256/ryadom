'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin, Phone, RotateCcw, Save } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Shop, UpdateShopPayload } from '@/lib/types';
import { Button, Card, CardHeader, Field, Input, Textarea, useToast } from '@/components/ui';

const PHONE_RE = /^\+998\d{9}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface FormState {
  name: string;
  phone: string;
  address_text: string;
  open_time: string;
  close_time: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

/** Some browsers return 'HH:mm:ss' from <input type="time">; the API wants 'HH:mm'. */
function normalizeTime(v: string): string {
  const s = (v || '').trim();
  return /^\d{2}:\d{2}:\d{2}$/.test(s) ? s.slice(0, 5) : s;
}

function fromShop(shop: Shop): FormState {
  return {
    name: shop.name ?? '',
    phone: shop.phone ?? '',
    address_text: shop.address_text ?? '',
    open_time: normalizeTime(shop.open_time ?? ''),
    close_time: normalizeTime(shop.close_time ?? ''),
  };
}

function validate(f: FormState): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name = "Do'kon nomini kiriting";
  else if (f.name.trim().length < 2) e.name = "Nom juda qisqa";
  if (!f.phone.trim()) e.phone = 'Telefon raqamini kiriting';
  else if (!PHONE_RE.test(f.phone.trim())) e.phone = "Format: +998XXXXXXXXX (jami 13 belgi)";
  if (!f.address_text.trim()) e.address_text = 'Manzilni kiriting';
  if (!f.open_time) e.open_time = 'Ochilish vaqtini kiriting';
  else if (!TIME_RE.test(f.open_time)) e.open_time = 'Format: HH:mm';
  if (!f.close_time) e.close_time = 'Yopilish vaqtini kiriting';
  else if (!TIME_RE.test(f.close_time)) e.close_time = 'Format: HH:mm';
  return e;
}

export function ShopInfoForm({ shop, onSaved }: { shop: Shop; onSaved: (shop: Shop) => void }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => fromShop(shop));
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep the form in sync when the shop changes from outside (logo upload, is_open toggle, refetch).
  // Editable fields are only re-seeded when the user has no unsaved edits.
  useEffect(() => {
    if (!touched) setForm(fromShop(shop));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id, shop.name, shop.phone, shop.address_text, shop.open_time, shop.close_time]);

  const initial = useMemo(() => fromShop(shop), [shop]);

  const dirtyPayload = useMemo<UpdateShopPayload>(() => {
    const p: UpdateShopPayload = {};
    const name = form.name.trim();
    const phone = form.phone.trim();
    const address = form.address_text.trim();
    const open = normalizeTime(form.open_time);
    const close = normalizeTime(form.close_time);
    if (name !== initial.name) p.name = name;
    if (phone !== initial.phone) p.phone = phone;
    if (address !== initial.address_text) p.address_text = address;
    if (open !== initial.open_time) p.open_time = open;
    if (close !== initial.close_time) p.close_time = close;
    return p;
  }, [form, initial]);

  const isDirty = Object.keys(dirtyPayload).length > 0;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setTouched(true);
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const reset = () => {
    setForm(fromShop(shop));
    setErrors({});
    setTouched(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate({ ...form, open_time: normalizeTime(form.open_time), close_time: normalizeTime(form.close_time) });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Formada xatolik bor", 'Belgilangan maydonlarni tekshiring');
      return;
    }
    if (!isDirty) {
      toast.info("O'zgarish yo'q", 'Saqlash uchun hech narsa o\'zgartirilmagan');
      return;
    }
    setSaving(true);
    try {
      // Only the editable fields; is_open / logo_url are handled elsewhere, lat/lng by the admin.
      const updated = await api.updateShop(dirtyPayload);
      setTouched(false);
      setForm(fromShop(updated));
      setErrors({});
      onSaved(updated);
      toast.success("Do'kon ma'lumotlari saqlandi");
    } catch (err) {
      toast.error("Saqlab bo'lmadi", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const hasCoords = Number.isFinite(Number(shop.lat)) && Number.isFinite(Number(shop.lng)) && !(Number(shop.lat) === 0 && Number(shop.lng) === 0);
  const mapHref = hasCoords ? `https://yandex.uz/maps/?text=${shop.lat},${shop.lng}` : null;

  return (
    <Card>
      <CardHeader
        title="Do'kon ma'lumotlari"
        description="Mijozlarga ko'rinadigan nom, telefon, manzil va ish vaqti"
        actions={
          isDirty && !saving ? (
            <Button variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={reset}>
              Bekor qilish
            </Button>
          ) : undefined
        }
      />
      <form onSubmit={submit} noValidate className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Do'kon nomi" htmlFor="shop-name" required error={errors.name} className="sm:col-span-2">
            <Input
              id="shop-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Masalan: Baraka Market"
              maxLength={120}
              invalid={!!errors.name}
              disabled={saving}
            />
          </Field>

          <Field label="Telefon" htmlFor="shop-phone" required error={errors.phone} hint={!errors.phone ? "Format: +998XXXXXXXXX" : undefined}>
            <Input
              id="shop-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value.replace(/[^\d+]/g, ''))}
              placeholder="+998901234567"
              maxLength={13}
              leftIcon={<Phone className="h-4 w-4" />}
              invalid={!!errors.phone}
              disabled={saving}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Ochilish" htmlFor="shop-open" required error={errors.open_time}>
              <Input
                id="shop-open"
                type="time"
                step={60}
                value={form.open_time}
                onChange={(e) => set('open_time', normalizeTime(e.target.value))}
                invalid={!!errors.open_time}
                disabled={saving}
              />
            </Field>
            <Field label="Yopilish" htmlFor="shop-close" required error={errors.close_time}>
              <Input
                id="shop-close"
                type="time"
                step={60}
                value={form.close_time}
                onChange={(e) => set('close_time', normalizeTime(e.target.value))}
                invalid={!!errors.close_time}
                disabled={saving}
              />
            </Field>
          </div>

          <Field label="Manzil" htmlFor="shop-address" required error={errors.address_text} className="sm:col-span-2">
            <Textarea
              id="shop-address"
              value={form.address_text}
              onChange={(e) => set('address_text', e.target.value)}
              placeholder="Shahar, ko'cha, uy raqami, mo'ljal"
              maxLength={500}
              rows={2}
              className="min-h-[64px]"
              invalid={!!errors.address_text}
              disabled={saving}
            />
          </Field>

          <Field
            label="Joylashuv (xaritada)"
            hint="Joylashuv administrator tomonidan o'zgartiriladi. Noto'g'ri bo'lsa, administratorga murojaat qiling."
            className="sm:col-span-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5 text-sm">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                {hasCoords ? (
                  <span className="font-mono text-slate-700 tabular-nums">
                    {Number(shop.lat).toFixed(6)}, {Number(shop.lng).toFixed(6)}
                  </span>
                ) : (
                  <span className="text-slate-500">Koordinatalar belgilanmagan</span>
                )}
              </div>
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
                >
                  Yandex xaritada ko'rish
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          {isDirty && !saving && <span className="mr-auto text-xs text-amber-700">Saqlanmagan o'zgarishlar bor</span>}
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={saving} disabled={!isDirty && !saving}>
            Saqlash
          </Button>
        </div>
      </form>
    </Card>
  );
}
