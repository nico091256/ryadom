'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { PromoCode, PromoPayload } from '@/lib/types';
import { cn, formatDate, formatMoney, formatNumber, somToTiyin, tiyinToSom, toYmd } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
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

const isExpired = (p: PromoCode) => !!p.expires_at && new Date(p.expires_at).getTime() < Date.now();
const isExhausted = (p: PromoCode) => p.usage_limit != null && p.usage_count >= p.usage_limit;

function PromoModal({
  open,
  promo,
  onClose,
  onSaved,
}: {
  open: boolean;
  promo: PromoCode | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const blank = {
    code: '',
    description: '',
    discount_percent: '10',
    max_discount: '',
    min_order: '',
    usage_limit: '',
    expires_at: '',
    is_active: true,
  };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(
      promo
        ? {
            code: promo.code,
            description: promo.description ?? '',
            discount_percent: String(promo.discount_percent),
            max_discount: tiyinToSom(promo.max_discount_tiyin),
            min_order: tiyinToSom(promo.min_order_tiyin),
            usage_limit: promo.usage_limit != null ? String(promo.usage_limit) : '',
            expires_at: promo.expires_at ? toYmd(new Date(promo.expires_at)) : '',
            is_active: promo.is_active,
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, promo]);

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    const code = f.code.trim().toUpperCase();
    if (!promo && !/^[A-Z0-9_-]{3,32}$/.test(code)) e.code = '3–32 ta lotin harf, raqam, _ yoki -';
    const pct = Number(f.discount_percent);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) e.discount_percent = '1 dan 100 gacha butun son';
    const num = (v: string) => v.trim() === '' || (Number.isFinite(Number(v.replace(/\s/g, ''))) && Number(v.replace(/\s/g, '')) >= 0);
    if (!num(f.max_discount)) e.max_discount = 'Musbat son kiriting';
    if (!num(f.min_order)) e.min_order = 'Musbat son kiriting';
    if (f.usage_limit.trim() !== '') {
      const ul = Number(f.usage_limit);
      if (!Number.isInteger(ul) || ul < 1) e.usage_limit = 'Kamida 1';
      else if (promo && ul < promo.usage_count) e.usage_limit = `Allaqachon ${promo.usage_count} marta ishlatilgan`;
    }
    if (f.expires_at && !promo && new Date(`${f.expires_at}T23:59:59`).getTime() < Date.now()) e.expires_at = "O'tgan sana tanlangan";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload: PromoPayload = {
      description: f.description.trim() || null,
      discount_percent: Number(f.discount_percent),
      max_discount_tiyin: f.max_discount.trim() ? somToTiyin(f.max_discount) : null,
      min_order_tiyin: f.min_order.trim() ? somToTiyin(f.min_order) : null,
      usage_limit: f.usage_limit.trim() ? Number(f.usage_limit) : null,
      expires_at: f.expires_at ? new Date(`${f.expires_at}T23:59:59`).toISOString() : null,
      is_active: f.is_active,
    };
    setSaving(true);
    try {
      if (promo) await api.updatePromoCode(promo.id, payload);
      else await api.createPromoCode({ ...payload, code: f.code.trim().toUpperCase() });
      toast.success(promo ? 'Promo-kod yangilandi' : 'Promo-kod yaratildi', promo?.code ?? f.code.trim().toUpperCase());
      onSaved();
    } catch (err) {
      const msg = errorMessage(err);
      if (/exist|mavjud|band/i.test(msg)) setErrors((p) => ({ ...p, code: 'Bu kod allaqachon mavjud' }));
      toast.error("Saqlab bo'lmadi", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={promo ? 'Promo-kodni tahrirlash' : 'Yangi promo-kod'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor
          </Button>
          <Button type="submit" form="promo-form" loading={saving}>
            Saqlash
          </Button>
        </>
      }
    >
      <form id="promo-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Kod" required={!promo} error={errors.code} hint={promo ? "Kodni o'zgartirib bo'lmaydi" : undefined}>
          <Input
            value={f.code}
            onChange={(e) => setF((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
            disabled={!!promo}
            invalid={!!errors.code}
            placeholder="RYADOM10"
            className="font-mono uppercase"
            autoFocus={!promo}
          />
        </Field>
        <Field label="Chegirma" required error={errors.discount_percent}>
          <Input type="number" min={1} max={100} value={f.discount_percent} onChange={set('discount_percent')} invalid={!!errors.discount_percent} rightAddon="%" />
        </Field>
        <Field label="Tavsif" className="sm:col-span-2">
          <Input value={f.description} onChange={set('description')} placeholder="Masalan: Birinchi buyurtma uchun" />
        </Field>
        <Field label="Maksimal chegirma" error={errors.max_discount} hint="Bo'sh — cheklovsiz">
          <Input inputMode="numeric" value={f.max_discount} onChange={set('max_discount')} invalid={!!errors.max_discount} placeholder="20 000" rightAddon="so'm" />
        </Field>
        <Field label="Minimal buyurtma" error={errors.min_order} hint="Bo'sh — cheklovsiz">
          <Input inputMode="numeric" value={f.min_order} onChange={set('min_order')} invalid={!!errors.min_order} placeholder="50 000" rightAddon="so'm" />
        </Field>
        <Field label="Foydalanish limiti" error={errors.usage_limit} hint="Bo'sh — cheksiz">
          <Input type="number" min={1} value={f.usage_limit} onChange={set('usage_limit')} invalid={!!errors.usage_limit} placeholder="100" />
        </Field>
        <Field label="Amal qilish muddati" error={errors.expires_at} hint="Kun oxirigacha amal qiladi">
          <Input type="date" value={f.expires_at} onChange={set('expires_at')} invalid={!!errors.expires_at} />
        </Field>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 sm:col-span-2">
          <div>
            <p className="text-sm font-medium text-slate-900">Faol</p>
            <p className="text-xs text-slate-500">O'chirilgan kodni mijozlar qo'llay olmaydi</p>
          </div>
          <Switch checked={f.is_active} onChange={(v) => setF((p) => ({ ...p, is_active: v }))} label="Faol" />
        </div>
      </form>
    </Modal>
  );
}

export default function PromoCodesPage() {
  const toast = useToast();
  const [items, setItems] = useState<PromoCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; promo: PromoCode | null }>({ open: false, promo: null });
  const [deleting, setDeleting] = useState<PromoCode | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.getPromoCodes();
      setItems(Array.isArray(list) ? list : []);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (id: string, p: Partial<PromoCode>) => setItems((xs) => (xs ? xs.map((x) => (x.id === id ? { ...x, ...p } : x)) : xs));

  const toggle = async (p: PromoCode, v: boolean) => {
    setToggling(p.id);
    patch(p.id, { is_active: v });
    try {
      await api.updatePromoCode(p.id, { is_active: v });
      toast.success(v ? 'Promo-kod yoqildi' : "Promo-kod o'chirildi", p.code);
    } catch (e) {
      patch(p.id, { is_active: !v });
      toast.error("O'zgartirib bo'lmadi", errorMessage(e));
    } finally {
      setToggling(null);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.deletePromoCode(deleting.id);
      setItems((xs) => (xs ? xs.filter((x) => x.id !== deleting.id) : xs));
      toast.success("Promo-kod o'chirildi", deleting.code);
      setDeleting(null);
    } catch (e) {
      toast.error("O'chirib bo'lmadi", errorMessage(e));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Promo-kodlar"
        description="Mijozlar buyurtma berishda qo'llaydigan chegirma kodlari"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ open: true, promo: null })}>
            Yangi promo-kod
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {error && !items ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <Table>
            <THead>
              <TH>Kod</TH>
              <TH align="right">Chegirma</TH>
              <TH align="right">Maks. chegirma</TH>
              <TH align="right">Min. buyurtma</TH>
              <TH>Ishlatilgan</TH>
              <TH>Muddati</TH>
              <TH align="center">Faol</TH>
              <TH />
            </THead>
            <TBody>
              {!items ? (
                <TableSkeleton rows={6} cols={8} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<TicketPercent className="h-6 w-6" />}
                      title="Promo-kodlar yo'q"
                      description="Mijozlarni jalb qilish uchun birinchi chegirma kodini yarating."
                      action={
                        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModal({ open: true, promo: null })}>
                          Promo-kod yaratish
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                items.map((p) => {
                  const expired = isExpired(p);
                  const exhausted = isExhausted(p);
                  const pct = p.usage_limit ? Math.min(100, (p.usage_count / p.usage_limit) * 100) : 0;
                  return (
                    <TR key={p.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-sm font-semibold text-slate-900">{p.code}</span>
                          <CopyButton value={p.code} />
                        </div>
                        {p.description && <p className="mt-1 max-w-[240px] truncate text-xs text-slate-400">{p.description}</p>}
                      </TD>
                      <TD align="right" className="font-semibold tabular-nums text-brand-700">
                        {p.discount_percent}%
                      </TD>
                      <TD align="right" className="tabular-nums">
                        {p.max_discount_tiyin != null ? formatMoney(p.max_discount_tiyin) : <span className="text-slate-400">—</span>}
                      </TD>
                      <TD align="right" className="tabular-nums">
                        {p.min_order_tiyin != null ? formatMoney(p.min_order_tiyin) : <span className="text-slate-400">—</span>}
                      </TD>
                      <TD>
                        <p className="tabular-nums text-slate-700">
                          {formatNumber(p.usage_count)} / {p.usage_limit != null ? formatNumber(p.usage_limit) : '∞'}
                        </p>
                        {p.usage_limit != null && (
                          <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className={cn('h-full rounded-full', exhausted ? 'bg-rose-500' : 'bg-brand-500')} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </TD>
                      <TD>
                        {p.expires_at ? (
                          <div className="flex items-center gap-2">
                            <span className={expired ? 'text-rose-600' : 'text-slate-700'}>{formatDate(p.expires_at)}</span>
                            {expired && <Badge tone="red">Muddati o'tgan</Badge>}
                          </div>
                        ) : (
                          <span className="text-slate-400">Muddatsiz</span>
                        )}
                        {exhausted && (
                          <Badge tone="amber" className="mt-1">
                            Limit tugagan
                          </Badge>
                        )}
                      </TD>
                      <TD align="center">
                        <Switch size="sm" checked={p.is_active} disabled={toggling === p.id} onChange={(v) => toggle(p, v)} label="Faol" />
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Tahrirlash" onClick={() => setModal({ open: true, promo: p })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="O'chirish" onClick={() => setDeleting(p)} className="hover:bg-rose-50 hover:text-rose-600">
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

      <PromoModal
        open={modal.open}
        promo={modal.promo}
        onClose={() => setModal({ open: false, promo: null })}
        onSaved={() => {
          setModal({ open: false, promo: null });
          load();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={deleteLoading}
        title="Promo-kodni o'chirish"
        message={
          <>
            <b className="font-mono">{deleting?.code}</b> butunlay o'chiriladi. Avval qo'llangan buyurtmalar o'zgarmaydi.
          </>
        }
        confirmLabel="O'chirish"
      />
    </div>
  );
}
