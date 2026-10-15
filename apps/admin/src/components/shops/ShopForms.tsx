'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, RefreshCw } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Shop } from '@/lib/types';
import { generatePassword } from '@/lib/format';
import { Button, Field, Input, Modal, SecretRow, Switch, useToast } from '@/components/ui';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^\+998\d{9}$/;
const TASHKENT = { lat: 41.2995, lng: 69.2401 };

type Errors = Record<string, string>;

function validateCommon(f: Record<string, any>): Errors {
  const e: Errors = {};
  if (!String(f.name || '').trim()) e.name = 'Nomini kiriting';
  if (!PHONE_RE.test(String(f.phone || '').replace(/\s/g, ''))) e.phone = 'Format: +998901234567';
  if (!String(f.address_text || '').trim()) e.address_text = 'Manzilni kiriting';
  const lat = Number(f.lat);
  const lng = Number(f.lng);
  if (f.lat === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) e.lat = "Noto'g'ri kenglik";
  if (f.lng === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) e.lng = "Noto'g'ri uzunlik";
  if (!TIME_RE.test(f.open_time)) e.open_time = 'Format: 08:00';
  if (!TIME_RE.test(f.close_time)) e.close_time = 'Format: 22:00';
  return e;
}

export interface Credentials {
  shopName: string;
  login: string;
  password: string;
  note?: string;
}

export function CredentialsModal({ creds, onClose }: { creds: Credentials | null; onClose: () => void }) {
  return (
    <Modal
      open={!!creds}
      onClose={onClose}
      size="sm"
      title="Sotuvchi kirish ma'lumotlari"
      description={creds?.shopName}
      footer={<Button onClick={onClose}>Tushunarli, saqladim</Button>}
    >
      {creds && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{creds.note ?? "Do'kon yaratildi. Quyidagi ma'lumotlarni sotuvchiga yetkazing."}</span>
          </div>
          <SecretRow label="Login" value={creds.login} />
          <SecretRow label="Parol" value={creds.password} />
          <p className="text-xs text-amber-700">
            Parol faqat hozir ko'rsatiladi. Sotuvchi birinchi kirishda uni o'zgartirishi shart.
          </p>
        </div>
      )}
    </Modal>
  );
}

export function CreateShopModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (creds: Credentials) => void;
}) {
  const toast = useToast();
  const blank = () => ({
    name: '',
    phone: '+998',
    address_text: '',
    lat: String(TASHKENT.lat),
    lng: String(TASHKENT.lng),
    open_time: '08:00',
    close_time: '22:00',
    seller_name: '',
    seller_login: '',
    seller_password: generatePassword(10),
  });
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setF(blank());
      setErrors({});
    }
  }, [open]);

  const set = (k: keyof ReturnType<typeof blank>) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCommon(f);
    if (!/^[a-z0-9_.-]{3,32}$/i.test(f.seller_login.trim())) errs.seller_login = '3–32 ta lotin harf, raqam yoki _ . -';
    if (f.seller_password.length < 6) errs.seller_password = 'Kamida 6 ta belgi';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const login = f.seller_login.trim();
      await api.createShop({
        name: f.name.trim(),
        phone: f.phone.replace(/\s/g, ''),
        address_text: f.address_text.trim(),
        lat: Number(f.lat),
        lng: Number(f.lng),
        open_time: f.open_time,
        close_time: f.close_time,
        seller_login: login,
        seller_password: f.seller_password,
        seller_name: f.seller_name.trim() || undefined,
      });
      toast.success("Do'kon yaratildi", f.name.trim());
      onCreated({ shopName: f.name.trim(), login, password: f.seller_password });
    } catch (err) {
      const msg = errorMessage(err);
      if (/login|username/i.test(msg)) setErrors((p) => ({ ...p, seller_login: 'Bu login band' }));
      toast.error("Do'konni yaratib bo'lmadi", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="lg"
      title="Yangi do'kon"
      description="Do'kon va uning sotuvchi akkauntini yaratish"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor
          </Button>
          <Button type="submit" form="create-shop-form" loading={saving}>
            Yaratish
          </Button>
        </>
      }
    >
      <form id="create-shop-form" onSubmit={submit} className="space-y-6" noValidate>
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Do'kon</legend>
          <Field label="Nomi" required error={errors.name} className="sm:col-span-2">
            <Input value={f.name} onChange={set('name')} invalid={!!errors.name} placeholder="Masalan: Chilonzor Oziq-Ovqat" />
          </Field>
          <Field label="Telefon" required error={errors.phone}>
            <Input value={f.phone} onChange={set('phone')} invalid={!!errors.phone} placeholder="+998901234567" inputMode="tel" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ochiladi" required error={errors.open_time}>
              <Input type="time" value={f.open_time} onChange={set('open_time')} invalid={!!errors.open_time} />
            </Field>
            <Field label="Yopiladi" required error={errors.close_time}>
              <Input type="time" value={f.close_time} onChange={set('close_time')} invalid={!!errors.close_time} />
            </Field>
          </div>
          <Field label="Manzil" required error={errors.address_text} className="sm:col-span-2">
            <Input value={f.address_text} onChange={set('address_text')} invalid={!!errors.address_text} placeholder="Toshkent sh., Chilonzor 9-kvartal, 12" />
          </Field>
          <Field label="Kenglik (lat)" required error={errors.lat}>
            <Input type="number" step="0.000001" value={f.lat} onChange={set('lat')} invalid={!!errors.lat} />
          </Field>
          <Field label="Uzunlik (lng)" required error={errors.lng} hint="Xaridorlar do'konni 3 km radiusda ko'radi">
            <Input type="number" step="0.000001" value={f.lng} onChange={set('lng')} invalid={!!errors.lng} />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Sotuvchi akkaunti</legend>
          <Field label="Ism-familiya" className="sm:col-span-2">
            <Input value={f.seller_name} onChange={set('seller_name')} placeholder="Masalan: Jamshid Karimov" />
          </Field>
          <Field label="Login" required error={errors.seller_login}>
            <Input value={f.seller_login} onChange={set('seller_login')} invalid={!!errors.seller_login} placeholder="seller_chilonzor" autoComplete="off" />
          </Field>
          <Field label="Boshlang'ich parol" required error={errors.seller_password}>
            <div className="flex gap-2">
              <Input
                value={f.seller_password}
                onChange={set('seller_password')}
                invalid={!!errors.seller_password}
                className="font-mono"
                autoComplete="off"
              />
              <Button
                variant="secondary"
                size="icon"
                title="Yangi parol yaratish"
                onClick={() => setF((p) => ({ ...p, seller_password: generatePassword(10) }))}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}

export function EditShopModal({
  shop,
  onClose,
  onSaved,
}: {
  shop: Shop | null;
  onClose: () => void;
  onSaved: (shop: Shop) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shop) {
      setF({
        name: shop.name,
        phone: shop.phone,
        address_text: shop.address_text,
        lat: String(shop.lat),
        lng: String(shop.lng),
        open_time: shop.open_time,
        close_time: shop.close_time,
        is_open: shop.is_open,
        is_active: shop.is_active,
        commission_rate_percent: String(shop.commission_rate_percent ?? 0),
        logo_url: shop.logo_url ?? '',
      });
      setErrors({});
    }
  }, [shop]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    const errs = validateCommon(f);
    const c = Number(f.commission_rate_percent);
    if (f.commission_rate_percent === '' || !Number.isFinite(c) || c < 0 || c > 100) errs.commission_rate_percent = '0 dan 100 gacha';
    if (f.logo_url && !/^https?:\/\//i.test(f.logo_url.trim())) errs.logo_url = "URL http(s):// bilan boshlanishi kerak";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const updated = await api.updateShop(shop.id, {
        name: f.name.trim(),
        phone: f.phone.replace(/\s/g, ''),
        address_text: f.address_text.trim(),
        lat: Number(f.lat),
        lng: Number(f.lng),
        open_time: f.open_time,
        close_time: f.close_time,
        is_open: !!f.is_open,
        is_active: !!f.is_active,
        commission_rate_percent: c,
        logo_url: f.logo_url.trim() || null,
      });
      toast.success("O'zgarishlar saqlandi", f.name.trim());
      onSaved({ ...shop, ...updated });
    } catch (err) {
      toast.error("Saqlab bo'lmadi", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!shop}
      onClose={saving ? () => {} : onClose}
      size="lg"
      title="Do'konni tahrirlash"
      description={shop?.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor
          </Button>
          <Button type="submit" form="edit-shop-form" loading={saving}>
            Saqlash
          </Button>
        </>
      }
    >
      <form id="edit-shop-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nomi" required error={errors.name} className="sm:col-span-2">
          <Input value={f.name ?? ''} onChange={set('name')} invalid={!!errors.name} />
        </Field>
        <Field label="Telefon" required error={errors.phone}>
          <Input value={f.phone ?? ''} onChange={set('phone')} invalid={!!errors.phone} inputMode="tel" />
        </Field>
        <Field label="Komissiya (%)" required error={errors.commission_rate_percent}>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={f.commission_rate_percent ?? ''}
            onChange={set('commission_rate_percent')}
            invalid={!!errors.commission_rate_percent}
          />
        </Field>
        <Field label="Manzil" required error={errors.address_text} className="sm:col-span-2">
          <Input value={f.address_text ?? ''} onChange={set('address_text')} invalid={!!errors.address_text} />
        </Field>
        <Field label="Kenglik (lat)" required error={errors.lat}>
          <Input type="number" step="0.000001" value={f.lat ?? ''} onChange={set('lat')} invalid={!!errors.lat} />
        </Field>
        <Field label="Uzunlik (lng)" required error={errors.lng}>
          <Input type="number" step="0.000001" value={f.lng ?? ''} onChange={set('lng')} invalid={!!errors.lng} />
        </Field>
        <Field label="Ochiladi" required error={errors.open_time}>
          <Input type="time" value={f.open_time ?? ''} onChange={set('open_time')} invalid={!!errors.open_time} />
        </Field>
        <Field label="Yopiladi" required error={errors.close_time}>
          <Input type="time" value={f.close_time ?? ''} onChange={set('close_time')} invalid={!!errors.close_time} />
        </Field>
        <Field label="Logo URL" error={errors.logo_url} className="sm:col-span-2">
          <Input value={f.logo_url ?? ''} onChange={set('logo_url')} invalid={!!errors.logo_url} placeholder="https://..." />
        </Field>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-slate-900">Faol</p>
            <p className="text-xs text-slate-500">O'chirilsa do'kon ilovada ko'rinmaydi</p>
          </div>
          <Switch checked={!!f.is_active} onChange={(v) => setF((p) => ({ ...p, is_active: v }))} label="Faol" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-slate-900">Buyurtma qabul qiladi</p>
            <p className="text-xs text-slate-500">Sotuvchining "ochiq" belgisi</p>
          </div>
          <Switch checked={!!f.is_open} onChange={(v) => setF((p) => ({ ...p, is_open: v }))} label="Ochiq" />
        </div>
      </form>
    </Modal>
  );
}

export function ResetPasswordButton({ shop, onDone }: { shop: Shop; onDone: (c: Credentials) => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const r = await api.resetShopPassword(shop.id);
      setConfirm(false);
      onDone({
        shopName: shop.name,
        login: r.login,
        password: r.tempPassword,
        note: "Yangi vaqtinchalik parol yaratildi. Eski parol endi ishlamaydi.",
      });
    } catch (e) {
      toast.error("Parolni tiklab bo'lmadi", errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Button variant="secondary" size="sm" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => setConfirm(true)}>
        Parolni tiklash
      </Button>
      <Modal
        open={confirm}
        onClose={() => !loading && setConfirm(false)}
        size="sm"
        title="Parolni tiklash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)} disabled={loading}>
              Bekor
            </Button>
            <Button onClick={run} loading={loading}>
              Tiklash
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <b>{shop.owner?.login}</b> uchun yangi vaqtinchalik parol yaratiladi. Sotuvchi keyingi kirishda uni o'zgartirishi kerak bo'ladi.
        </p>
      </Modal>
    </>
  );
}
