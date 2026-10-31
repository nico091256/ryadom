'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Plug, RefreshCw, Save, Trash2 } from 'lucide-react';
import { API_URL, api, errorMessage } from '@/lib/api';
import type { PosType, Shop } from '@/lib/types';
import { POS_TYPES } from '@/lib/constants';
import { Button, Card, CardHeader, ConfirmDialog, Field, Input, SecretRow, Select, useToast } from '@/components/ui';

const URL_RE = /^https?:\/\/\S+$/i;

/**
 * Kassa (POS) integratsiyasi: do'kon uchun API kalit yaratish/bekor qilish,
 * kassa turi va yangi buyurtma webhook manzilini sozlash, ulanish uchun qisqa
 * yo'riqnoma. Kalit faqat shu do'konning /pos/* endpointlariga ruxsat beradi.
 */
export function PosIntegrationCard({ shop, onUpdated }: { shop: Shop; onUpdated: (shop: Shop) => void }) {
  const toast = useToast();
  const [posType, setPosType] = useState<PosType>(shop.pos_type ?? 'custom');
  const [webhookUrl, setWebhookUrl] = useState(shop.pos_webhook_url ?? '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [confirm, setConfirm] = useState<'regenerate' | 'revoke' | null>(null);

  // Tashqaridan (refetch) kelgan qiymatlar bilan sinxron.
  useEffect(() => {
    setPosType(shop.pos_type ?? 'custom');
    setWebhookUrl(shop.pos_webhook_url ?? '');
    setUrlError(null);
  }, [shop.id, shop.pos_type, shop.pos_webhook_url]);

  const isDirty = posType !== (shop.pos_type ?? 'custom') || webhookUrl.trim() !== (shop.pos_webhook_url ?? '');
  const hasKey = !!shop.pos_api_key;

  const save = async () => {
    const url = webhookUrl.trim();
    if (url && !URL_RE.test(url)) {
      setUrlError('Manzil http:// yoki https:// bilan boshlanishi kerak');
      return;
    }
    setUrlError(null);
    setSaving(true);
    try {
      const updated = await api.updatePosSettings({ pos_type: posType, pos_webhook_url: url || null });
      onUpdated(updated);
      toast.success('POS sozlamalari saqlandi');
    } catch (e) {
      toast.error("Saqlab bo'lmadi", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setKeyBusy(true);
    try {
      const { pos_api_key } = await api.generatePosApiKey();
      onUpdated({ ...shop, pos_api_key });
      toast.success(hasKey ? 'Yangi API kalit yaratildi' : 'API kalit yaratildi', hasKey ? 'Eski kalit endi ishlamaydi' : undefined);
    } catch (e) {
      toast.error("Kalit yaratib bo'lmadi", errorMessage(e));
    } finally {
      setKeyBusy(false);
      setConfirm(null);
    }
  };

  const revoke = async () => {
    setKeyBusy(true);
    try {
      const updated = await api.revokePosApiKey();
      onUpdated(updated);
      toast.success('API kalit bekor qilindi', 'Kassa tizimi endi ulana olmaydi');
    } catch (e) {
      toast.error("Bekor qilib bo'lmadi", errorMessage(e));
    } finally {
      setKeyBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Kassa (POS) integratsiyasi"
        description="1C, Jowi, iiko, Billz, Poster yoki o'z tizimingizni API orqali ulang"
      />
      <div className="space-y-5 p-5">
        {/* API kalit */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <KeyRound className="h-4 w-4 text-slate-400" />
            API kalit
          </div>
          {hasKey ? (
            <>
              <SecretRow label="X-API-Key" value={shop.pos_api_key as string} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={() => setConfirm('regenerate')}
                  disabled={keyBusy}
                >
                  Qayta yaratish
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setConfirm('revoke')}
                  disabled={keyBusy}
                >
                  Bekor qilish
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
              <p className="text-sm text-slate-600">Kassa tizimi hali ulanmagan. Kalit yaratib, uni kassa dasturiga kiriting.</p>
              <Button size="sm" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={generate} loading={keyBusy}>
                Kalit yaratish
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Kalit faqat sizning do'koningiz uchun ishlaydi. Begonaga bermang; sizib chiqsa — "Qayta yaratish".
          </p>
        </div>

        {/* Sozlamalar */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kassa tizimi" htmlFor="pos-type">
            <Select id="pos-type" value={posType} onChange={(e) => setPosType(e.target.value as PosType)} disabled={saving}>
              {POS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Webhook manzili (yangi buyurtma)"
            htmlFor="pos-webhook"
            error={urlError ?? undefined}
            hint={!urlError ? "Yangi buyurtma tushganda shu manzilga JSON POST yuboriladi. Bo'sh qoldirsangiz yuborilmaydi." : undefined}
          >
            <Input
              id="pos-webhook"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="https://kassa.example.uz/ryadom/webhook"
              inputMode="url"
              invalid={!!urlError}
              disabled={saving}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          {isDirty && !saving && <span className="mr-auto text-xs text-amber-700">Saqlanmagan o'zgarishlar bor</span>}
          <Button icon={<Save className="h-4 w-4" />} loading={saving} disabled={!isDirty && !saving} onClick={save}>
            Saqlash
          </Button>
        </div>

        {/* Qisqa yo'riqnoma */}
        <details className="group rounded-lg border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-800">
            <Plug className="h-4 w-4 text-slate-400" />
            Ulanish yo'riqnomasi (dasturchi uchun)
          </summary>
          <div className="space-y-2 border-t border-slate-200 px-3 py-3 text-xs text-slate-600">
            <p>
              Asosiy manzil: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-slate-200">{API_URL}</code>
            </p>
            <p>
              Har bir so'rovga sarlavha: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-slate-200">X-API-Key: &lt;kalit&gt;</code>
            </p>
            <ul className="list-disc space-y-1 pl-5 font-mono">
              <li>
                POST /pos/products/sync — {'{ items: [{ barcode | sku, price (tiyin), stock, is_available }] }'}
              </li>
              <li>GET /pos/orders/pending?status=new|accepted|on_the_way&amp;limit=50</li>
              <li>POST /pos/orders/{'{id}'}/status — {'{ status: accepted|on_the_way|delivered|cancelled, reason? }'}</li>
            </ul>
            <p>
              Webhook: yangi buyurtmada <code className="font-mono">POST</code> {'{ event: "order.created", shop_id, data: {...} }'};
              sarlavhalar <code className="font-mono">X-Ryadom-Event</code> va <code className="font-mono">X-Ryadom-Signature: sha256=HMAC_SHA256(body, kalit)</code>.
            </p>
            <p>Narxlar tiyinda (1 so'm = 100 tiyin). Mahsulot shtrix-kod yoki SKU bo'yicha topiladi — avval ularni "Mahsulotlar"da to'ldiring.</p>
          </div>
        </details>
      </div>

      <ConfirmDialog
        open={confirm === 'regenerate'}
        onClose={() => !keyBusy && setConfirm(null)}
        onConfirm={generate}
        loading={keyBusy}
        tone="primary"
        title="API kalitni qayta yaratish"
        message="Hozirgi kalit darhol ishlamay qoladi. Kassa dasturiga yangi kalitni kiritishingiz kerak bo'ladi."
        confirmLabel="Qayta yaratish"
      />
      <ConfirmDialog
        open={confirm === 'revoke'}
        onClose={() => !keyBusy && setConfirm(null)}
        onConfirm={revoke}
        loading={keyBusy}
        title="API kalitni bekor qilish"
        message="Kassa tizimi do'koningizga ulana olmaydi. Keyin istalgan vaqt yangi kalit yaratishingiz mumkin."
        confirmLabel="Bekor qilish"
      />
    </Card>
  );
}
