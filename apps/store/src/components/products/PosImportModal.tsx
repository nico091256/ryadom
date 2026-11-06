'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CloudDownload, FileSpreadsheet, Sparkles, Upload } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Category, PosCatalogSyncResult } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import { Badge, Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui';

const SAMPLE_REGOS_CSV = [
  'Код;Артикул;Штрихкод;Наименование;Цена;Остаток;Группа',
  '201;REG-YOG-01;4780020010015;"Oleina Kungaboqar yog\'i 1L";21000;35;"Oziq-ovqat"',
  '202;REG-MKR-02;4780020010022;"Makfa Makaron 400g";11500;50;"Non va pishiriqlar"',
  '203;REG-CHY-03;4780020010039;"Toshkent Ko\'k choyi 100g";14000;40;"Ichimliklar va sharbatlar"',
  '204;REG-TVR-04;4780020010046;"agroBravo Tvorog 9% 200g";12500;20;"Sut va sut mahsulotlari"',
  '205;REG-SHK-05;4780020010053;"Nestle KitKat 45g";9500;65;"Shirinliklar va gazaklar"',
].join('\n');

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseRawCatalogText(text: string): Record<string, any>[] {
  const cleaned = (text ?? '').replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  // JSON array or REGOS { ok, result: [...] } envelope
  if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.result)) return parsed.result;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    } catch {
      return [];
    }
  }

  // CSV / TSV
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const semi = (headerLine.match(/;/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  const delimiter = tab > semi && tab > comma ? '\t' : semi >= comma ? ';' : ',';

  const headers = splitCsvLine(headerLine, delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.every((c) => !c)) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = (cols[idx] ?? '').replace(/^["']|["']$/g, '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

export function PosImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [tab, setTab] = useState<'regos_api' | 'file'>('regos_api');
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultCategoryId, setDefaultCategoryId] = useState('');

  // REGOS API state
  const [integrationKey, setIntegrationKey] = useState('demo');
  const [stockId, setStockId] = useState('1');
  const [priceTypeId, setPriceTypeId] = useState('1');

  // File / CSV state
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<PosCatalogSyncResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setLastResult(null);
    api
      .getCategories()
      .then((list) => {
        setCategories(list);
        if (list.length > 0 && !defaultCategoryId) {
          setDefaultCategoryId(list[0].id);
        }
      })
      .catch(() => {});
  }, [open, defaultCategoryId]);

  const parsedFileRows = useMemo(() => parseRawCatalogText(rawText), [rawText]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setRawText(text);
    e.target.value = '';
  };

  const runRegosSync = async () => {
    if (!integrationKey.trim()) {
      toast.error('REGOS kalitini kiriting', 'Masalan: integratsiya kaliti yoki sinov uchun "demo"');
      return;
    }
    setBusy(true);
    setLastResult(null);
    try {
      const sId = Number(stockId);
      const pId = Number(priceTypeId);
      const res = await api.syncFromRegos({
        integration_key: integrationKey.trim(),
        ...(Number.isInteger(sId) && sId > 0 ? { stock_id: sId } : {}),
        ...(Number.isInteger(pId) && pId > 0 ? { price_type_id: pId } : {}),
        ...(defaultCategoryId ? { default_category_id: defaultCategoryId } : {}),
      });
      setLastResult(res);
      toast.success(
        'REGOS sinxronizatsiyasi yakunlandi',
        `${res.created} ta yangi mahsulot qo'shildi, ${res.updated} ta yangilandi`,
      );
      onImported();
    } catch (e) {
      toast.error("REGOS dan yuklab bo'lmadi", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runFileImport = async () => {
    if (parsedFileRows.length === 0) {
      toast.error("Ma'lumot topilmadi", 'CSV yoki JSON fayl tanlang yoki namunani yuklang');
      return;
    }
    setBusy(true);
    setLastResult(null);
    try {
      const BATCH_SIZE = 200;
      const totals: PosCatalogSyncResult = {
        source: 'file_import',
        created: 0,
        updated: 0,
        skipped: 0,
        total: 0,
      };
      for (let offset = 0; offset < parsedFileRows.length; offset += BATCH_SIZE) {
        const batch = parsedFileRows.slice(offset, offset + BATCH_SIZE);
        const res = await api.bulkImportPosItems({
          items: batch,
          ...(defaultCategoryId ? { default_category_id: defaultCategoryId } : {}),
          price_in_som: true,
        });
        totals.created += res.created ?? 0;
        totals.updated += res.updated ?? 0;
        totals.skipped += res.skipped ?? 0;
        totals.total += res.total ?? batch.length;
      }
      setLastResult(totals);
      toast.success(
        'Mahsulotlar muvaffaqiyatli yuklandi',
        `${totals.created} ta yangi yaratildi, ${totals.updated} ta yangilandi`,
      );
      onImported();
    } catch (e) {
      toast.error("Fayldan yuklab bo'lmadi", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="REGOS (POS) dan mahsulotlarni avtomatik yuklash"
      description="Magazinchi mahsulotlarni bittalab qo'shmasligi uchun REGOS API yoki CSV/JSON eksport orqali barcha nomenklaturani bir marta bosishda yuklang."
      size="lg"
    >
      <div className="space-y-5">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab('regos_api')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === 'regos_api' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CloudDownload className="h-4 w-4 text-emerald-600" />
            REGOS.Online API (Avto)
          </button>
          <button
            type="button"
            onClick={() => setTab('file')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === 'file' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            REGOS CSV / JSON fayldan
          </button>
        </div>

        {/* Default category selector */}
        <Field
          label="Standart kategoriya (guruh mos kelmagan mahsulotlar uchun)"
          htmlFor="pos-import-category"
          hint="REGOS dagi guruh nomi ('Sut', 'Ichimliklar', 'Non' va h.k.) avtomatik moslanadi; qolganlari shu kategoriyaga tushadi."
        >
          <Select
            id="pos-import-category"
            value={defaultCategoryId}
            onChange={(e) => setDefaultCategoryId(e.target.value)}
            disabled={busy}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_uz}
              </option>
            ))}
          </Select>
        </Field>

        {tab === 'regos_api' ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">REGOS.Online Gateway ulanishi</h4>
                <p className="text-xs text-slate-500">
                  REGOS.Online → Интеграции bo'limidan olingan kalitni (yoki sinov uchun <code className="font-mono font-semibold text-emerald-700">demo</code>) kiriting
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => setIntegrationKey('demo')}
                disabled={busy}
              >
                Demo kalitni qo'yish
              </Button>
            </div>

            <Field
              label="REGOS Integration Key yoki Gateway URL"
              htmlFor="regos-integration-key"
              hint="Format: https://integration.regos.uz/gateway/out/{kalit}/v1/item/getext"
            >
              <Input
                id="regos-integration-key"
                value={integrationKey}
                onChange={(e) => setIntegrationKey(e.target.value)}
                placeholder="demo yoki 9a8b7c6d5e4f..."
                disabled={busy}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="REGOS Ombor ID (stock_id)" htmlFor="regos-stock-id">
                <Input
                  id="regos-stock-id"
                  type="number"
                  min={1}
                  value={stockId}
                  onChange={(e) => setStockId(e.target.value)}
                  placeholder="1"
                  disabled={busy}
                />
              </Field>
              <Field label="REGOS Narx turi ID (price_type_id)" htmlFor="regos-price-type-id">
                <Input
                  id="regos-price-type-id"
                  type="number"
                  min={1}
                  value={priceTypeId}
                  onChange={(e) => setPriceTypeId(e.target.value)}
                  placeholder="1"
                  disabled={busy}
                />
              </Field>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">REGOS CSV yoki JSON eksport fayli</h4>
                <p className="text-xs text-slate-500">
                  Ustunlar: <code className="font-mono">Код;Артикул;Штрихкод;Наименование;Цена;Остаток;Группа</code> (narx so'mda)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="h-3.5 w-3.5" />}
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  Fayl tanlash
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setFileName('regos-sample.csv');
                    setRawText(SAMPLE_REGOS_CSV);
                  }}
                  disabled={busy}
                >
                  Namunani to'ldirish
                </Button>
              </div>
            </div>

            {fileName && (
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
                <span>
                  Fayl: <b>{fileName}</b>
                </span>
                <Badge tone="green">{formatNumber(parsedFileRows.length)} ta qator aniqlandi</Badge>
              </div>
            )}

            <Field label="CSV yoki JSON ma'lumotlari" htmlFor="regos-csv-text">
              <Textarea
                id="regos-csv-text"
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={SAMPLE_REGOS_CSV}
                className="font-mono text-xs"
                disabled={busy}
              />
            </Field>
          </div>
        )}

        {lastResult && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="space-y-1">
              <p className="font-semibold">Sinxronizatsiya muvaffaqiyatli bajarildi!</p>
              <p className="text-xs text-emerald-800">
                Yangi qo'shildi: <b>{lastResult.created} ta</b> · Yangilandi: <b>{lastResult.updated} ta</b> · O'tkazib yuborildi:{' '}
                <b>{lastResult.skipped} ta</b> (Jami: {lastResult.total} ta)
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Yopish
          </Button>
          {tab === 'regos_api' ? (
            <Button
              type="button"
              icon={<CloudDownload className="h-4 w-4" />}
              loading={busy}
              onClick={runRegosSync}
            >
              REGOS dan mahsulotlarni tortish
            </Button>
          ) : (
            <Button
              type="button"
              icon={<Upload className="h-4 w-4" />}
              loading={busy}
              disabled={parsedFileRows.length === 0}
              onClick={runFileImport}
            >
              Barchasini bazaga yuklash ({formatNumber(parsedFileRows.length)} ta)
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
