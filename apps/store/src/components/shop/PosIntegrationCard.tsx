'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudDownload, KeyRound, Plug, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { API_URL, api, errorMessage } from '@/lib/api';
import type { Category, PosCatalogSyncResult, PosType, Shop } from '@/lib/types';
import { POS_TYPES } from '@/lib/constants';
import { Button, Card, CardHeader, ConfirmDialog, Field, Input, SecretRow, Select, useToast } from '@/components/ui';

const URL_RE = /^https?:\/\/\S+$/i;

/**
 * Kassa (POS) integratsiyasi: do'kon uchun API kalit yaratish/bekor qilish,
 * REGOS.Online (Item/GetExt) dan barcha mahsulotlarni avtomatik tortib olish,
 * kassa turi va yangi buyurtma webhook manzilini sozlash, ulanish uchun qisqa
 * yo'riqnoma. Kalit faqat shu do'konning /pos/* endpointlariga ruxsat beradi.
 */
export function PosIntegrationCard({ shop, onUpdated }: { shop: Shop; onUpdated: (shop: Shop) => void }) {
  const toast = useToast();
  const [posType, setPosType] = useState<PosType>(shop.pos_type ?? 'regos');
  const [webhookUrl, setWebhookUrl] = useState(shop.pos_webhook_url ?? '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [confirm, setConfirm] = useState<'regenerate' | 'revoke' | null>(null);

  // REGOS.Online catalog pull state
  const [regosKey, setRegosKey] = useState('demo');
  const [regosStockId, setRegosStockId] = useState('1');
  const [regosPriceTypeId, setRegosPriceTypeId] = useState('1');
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultCatId, setDefaultCatId] = useState('');
  const [syncingRegos, setSyncingRegos] = useState(false);
  const [syncResult, setSyncResult] = useState<PosCatalogSyncResult | null>(null);

  // Tashqaridan (refetch) kelgan qiymatlar bilan sinxron.
  useEffect(() => {
    setPosType(shop.pos_type ?? 'regos');
    setWebhookUrl(shop.pos_webhook_url ?? '');
    setUrlError(null);
  }, [shop.id, shop.pos_type, shop.pos_webhook_url]);

  useEffect(() => {
    api
      .getCategories()
      .then((list) => {
        setCategories(list);
        if (list.length > 0) setDefaultCatId((prev) => prev || list[0].id);
      })
      .catch(() => {});
  }, []);

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

  const syncRegosCatalog = async (overrideKey?: string) => {
    const keyToUse = (overrideKey ?? regosKey).trim();
    if (!keyToUse) {
      toast.error('REGOS kalitini kiriting', 'Masalan: integratsiya kaliti yoki sinov uchun "demo"');
      return;
    }
    if (overrideKey) setRegosKey(overrideKey);
    setSyncingRegos(true);
    setSyncResult(null);
    try {
      const sId = Number(regosStockId);
      const pId = Number(regosPriceTypeId);
      const res = await api.syncFromRegos({
        integration_key: keyToUse,
        ...(Number.isInteger(sId) && sId > 0 ? { stock_id: sId } : {}),
        ...(Number.isInteger(pId) && pId > 0 ? { price_type_id: pId } : {}),
        ...(defaultCatId ? { default_category_id: defaultCatId } : {}),
      });
      setSyncResult(res);
      if (shop.pos_type !== 'regos') {
        onUpdated({ ...shop, pos_type: 'regos' });
      }
      toast.success(
        'REGOS mahsulotlari sinxronlandi',
        `${res.created} ta yangi qo'shildi, ${res.updated} ta yangilandi`,
      );
    } catch (e) {
      toast.error("REGOS dan tortib bo'lmadi", errorMessage(e));
    } finally {
      setSyncingRegos(false);
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
        title="Kassa (POS) integratsiyasi — REGOS.Online"
        description="REGOS, 1C, Jowi, iiko, Billz, Poster tizimlarini ulang va mahsulotlarni qo'lda kiritmasdan avtomatik tortib oling"
      />
      <div className="space-y-5 p-5">
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

        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 pb-4">
          {isDirty && !saving && <span className="mr-auto text-xs text-amber-700">Saqlanmagan o'zgarishlar bor</span>}
          <Button icon={<Save className="h-4 w-4" />} loading={saving} disabled={!isDirty && !saving} onClick={save}>
            Sozlamalarni saqlash
          </Button>
        </div>

        {/* REGOS.Online Avto-Sinxronizatsiya bloki */}
        {posType === 'regos' && (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  REGOS.Online dan barcha mahsulotlarni avtomatik tortish (Item/GetExt)
                </h4>
                <p className="mt-0.5 text-xs text-slate-600">
                  Magazinchi mahsulotlarni bittalab qo'shib chiqmasligi uchun REGOS.Online integratsiya kalitini kiriting — barcha mahsulotlar, narxlar (so'mdan tiyinga) va ombor qoldiqlari avtomatik yaratiladi.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5 text-emerald-600" />}
                loading={syncingRegos}
                onClick={() => syncRegosCatalog('demo')}
              >
                Demo REGOS bazasidan sinash
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Field
                  label="REGOS Integration Key yoki Gateway URL"
                  htmlFor="shop-regos-key"
                  hint="Masalan: integration.regos.uz kaliti yoki 'demo'"
                >
                  <Input
                    id="shop-regos-key"
                    value={regosKey}
                    onChange={(e) => setRegosKey(e.target.value)}
                    placeholder="demo yoki REGOS kaliti"
                    disabled={syncingRegos}
                  />
                </Field>
              </div>
              <Field label="Ombor ID (stock_id)" htmlFor="shop-regos-stock">
                <Input
                  id="shop-regos-stock"
                  type="number"
                  min={1}
                  value={regosStockId}
                  onChange={(e) => setRegosStockId(e.target.value)}
                  placeholder="1"
                  disabled={syncingRegos}
                />
              </Field>
              <Field label="Narx turi (price_type_id)" htmlFor="shop-regos-price-type">
                <Input
                  id="shop-regos-price-type"
                  type="number"
                  min={1}
                  value={regosPriceTypeId}
                  onChange={(e) => setRegosPriceTypeId(e.target.value)}
                  placeholder="1"
                  disabled={syncingRegos}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="w-full sm:w-72">
                <Field label="Standart kategoriya (yangi mahsulotlar uchun)" htmlFor="shop-regos-cat">
                  <Select
                    id="shop-regos-cat"
                    value={defaultCatId}
                    onChange={(e) => setDefaultCatId(e.target.value)}
                    disabled={syncingRegos}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_uz}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                type="button"
                icon={<CloudDownload className="h-4 w-4" />}
                loading={syncingRegos}
                onClick={() => syncRegosCatalog()}
              >
                REGOS dan mahsulotlarni tortish
              </Button>
            </div>

            {syncResult && (
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  REGOS sinxronizatsiyasi yakunlandi: <b>{syncResult.created} ta</b> yangi mahsulot yaratildi,{' '}
                  <b>{syncResult.updated} ta</b> mahsulot yangilandi (Jami: {syncResult.total} ta).
                </span>
              </div>
            )}
          </div>
        )}

        {/* API kalit */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <KeyRound className="h-4 w-4 text-slate-400" />
            Push-API kalit (Kassadan Ryadom ga yuborish uchun)
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
              <p className="text-sm text-slate-600">Kassa dasturidan avtomatik push-sinxronlash uchun API kalit yarating.</p>
              <Button size="sm" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={generate} loading={keyBusy}>
                Kalit yaratish
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Kalit faqat sizning do'koningiz uchun ishlaydi. Begonaga bermang; sizib chiqsa — "Qayta yaratish".
          </p>
        </div>

        {/* Qisqa yo'riqnoma */}
        <details className="group rounded-lg border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-800">
            <Plug className="h-4 w-4 text-slate-400" />
            Ulanish yo'riqnomasi (REGOS va dasturchilar uchun)
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
                POST /pos/products/sync — {'{ items: [{ barcode | sku, name, category_name?, price (tiyin), stock, is_available }] }'}
              </li>
              <li>GET /pos/orders/incoming?status=new|accepted|on_the_way&amp;limit=50 (alias: /pos/orders/pending)</li>
              <li>POST /pos/orders/{'{id}'}/status — {'{ status: accepted|on_the_way|delivered|cancelled, reason? }'}</li>
            </ul>
            <p>
              <b>Avto-yaratish (Upsert):</b> Agar <code className="font-mono">POST /pos/products/sync</code> so'rovida yangi shtrix-kod bilan birga{' '}
              <code className="font-mono">name</code> (yoki <code className="font-mono">name_uz</code>) yuborilsa, mahsulot do'kon bazasida avtomatik yaratiladi!
            </p>
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
