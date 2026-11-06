import { MAX_PRODUCT_PRICE_TIYIN, MAX_PRODUCT_STOCK } from '@localshop/shared';

export interface NormalizedPosProduct {
  barcode: string | null;
  sku: string | null;
  name_uz: string;
  name_ru: string;
  name_en: string;
  description_uz: string | null;
  price: number; // in tiyin (1 UZS = 100 tiyin)
  stock: number;
  is_available: boolean;
  image_url: string | null;
  category_id?: string | null;
  group_name?: string | null;
}

export interface CategoryRef {
  id: string;
  name_uz: string;
  name_ru?: string | null;
  name_en?: string | null;
}

/** Realistic REGOS Item/GetExt demo dataset for immediate testing without external credentials. */
export const DEMO_REGOS_ITEMS: Record<string, any>[] = [
  {
    id: 1001,
    code: 1001,
    articul: 'REG-NON-01',
    barcode: '4780010010018',
    name: 'Patir non (Issiq tandir)',
    fullname: "Patir non (Issiq tandir, 400g)",
    price: 7000, // 7 000 so'm
    quantity: 40,
    group: { id: 10, name: 'Non va pishiriqlar' },
    image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=400&q=80',
    deleted: false,
  },
  {
    id: 1002,
    code: 1002,
    articul: 'REG-SUT-02',
    barcode: '4780010010025',
    name: 'Lactel Sut 2.5% 1L',
    fullname: 'Lactel tabiiy sut 2.5% 1 litr tetrapak',
    price: 14500, // 14 500 so'm
    quantity: 32,
    group: { id: 20, name: 'Sut va sut mahsulotlari' },
    image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
    deleted: false,
  },
  {
    id: 1003,
    code: 1003,
    articul: 'REG-KAY-03',
    barcode: '4780010010032',
    name: 'Pure Milky Qaymoq 20% 200g',
    fullname: 'Pure Milky tabiiy qaymoq 20% 200g',
    price: 11000, // 11 000 so'm
    quantity: 18,
    group: { id: 20, name: 'Sut va sut mahsulotlari' },
    image_url: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=400&q=80',
    deleted: false,
  },
  {
    id: 1004,
    code: 1004,
    articul: 'REG-SUV-04',
    barcode: '4780010010049',
    name: 'Chortoq mineral suvi 0.5L',
    fullname: 'Chortoq gazlangan shifobaxsh mineral suvi 0.5L (shisha)',
    price: 6500, // 6 500 so'm
    quantity: 85,
    group: { id: 30, name: 'Ichimliklar va sharbatlar' },
    image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=400&q=80',
    deleted: false,
  },
  {
    id: 1005,
    code: 1005,
    articul: 'REG-SHB-05',
    barcode: '4780010010056',
    name: 'Dena Olma sharbati 1L',
    fullname: 'Dena 100% tabiiy olma sharbati 1 litr',
    price: 15000, // 15 000 so'm
    quantity: 28,
    group: { id: 30, name: 'Ichimliklar va sharbatlar' },
    image_url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=400&q=80',
    deleted: false,
  },
  {
    id: 1006,
    code: 1006,
    articul: 'REG-MEV-06',
    barcode: '4780010010063',
    name: 'Ekvador banani (1 kg)',
    fullname: 'Yangi sarxil Ekvador banani (1 kg)',
    price: 24000, // 24 000 so'm
    quantity: 22,
    group: { id: 40, name: 'Meva va sabzavotlar' },
    image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80',
    deleted: false,
  },
  {
    id: 1007,
    code: 1007,
    articul: 'REG-SHR-07',
    barcode: '4780010010070',
    name: 'Alpen Gold Sutli shokolad 85g',
    fullname: "Alpen Gold o'rmon yong'oqli va sutli shokolad 85g",
    price: 13500, // 13 500 so'm
    quantity: 45,
    group: { id: 50, name: 'Shirinliklar va gazaklar' },
    image_url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=400&q=80',
    deleted: false,
  },
  {
    id: 1008,
    code: 1008,
    articul: 'REG-NON-08',
    barcode: '4780000000012',
    name: 'Samarqand noni',
    fullname: "Issiq va xushbo'y an'anaviy Samarqand tandir noni",
    price: 8500, // 8 500 so'm
    quantity: 60,
    group: { id: 10, name: 'Non va pishiriqlar' },
    image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=400&q=80',
    deleted: false,
  },
];

const ALLOWED_REGOS_HOSTS = new Set(['integration.regos.uz', 'api.regos.uz']);

/**
 * Resolves either a bare REGOS integration key (e.g. `9a8b7c6d...`) or a full
 * gateway URL (`https://integration.regos.uz/gateway/out/9a8b7c6d/v1`) into
 * a normalized base URL without trailing slash. Returns `'demo'` for demo keys.
 * Strictly allowlists `https://integration.regos.uz` and `https://api.regos.uz` to prevent SSRF.
 */
export function resolveRegosGatewayUrl(keyOrUrl: string): string {
  const raw = (keyOrUrl ?? '').trim();
  if (!raw) throw new Error('REGOS integration key is required');
  if (/^demo(_regos.*)?$/i.test(raw)) return 'demo';

  if (/^https?:\/\//i.test(raw) || raw.includes('://')) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error('Invalid REGOS gateway URL');
    }
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || !ALLOWED_REGOS_HOSTS.has(host) || parsed.port !== '') {
      throw new Error('REGOS gateway URL must use https://integration.regos.uz or https://api.regos.uz');
    }
    const match = /\/gateway\/out\/([A-Za-z0-9_\-]+)(?:\/v1)?/i.exec(parsed.pathname);
    if (!match?.[1]) {
      throw new Error('Invalid REGOS gateway path (expected /gateway/out/<key>/v1)');
    }
    return `https://${host}/gateway/out/${match[1]}/v1`;
  }

  const sanitizedKey = raw.replace(/[^A-Za-z0-9_\-]/g, '');
  if (!sanitizedKey) throw new Error('Invalid REGOS integration key');
  return `https://integration.regos.uz/gateway/out/${sanitizedKey}/v1`;
}

/**
 * Cleans an arbitrary barcode or SKU / articul from REGOS so it conforms to
 * PRODUCT_CODE_REGEX (`/^[A-Za-z0-9][A-Za-z0-9._\-\/]{0,63}$/`).
 */
export function sanitizeProductCode(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._\-\/]/g, '')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 64);
  return str.length > 0 ? str : null;
}

/** Extracts the primary barcode from a REGOS item (`barcode` string or `barcodes` array). */
export function extractRegosBarcode(item: Record<string, any>): string | null {
  const direct = sanitizeProductCode(
    item.barcode ?? item.shtrix ?? item.ean ?? item['Штрихкод'] ?? item['Shtrix-kod'],
  );
  if (direct) return direct;

  if (Array.isArray(item.barcodes) && item.barcodes.length > 0) {
    const first = item.barcodes[0];
    if (typeof first === 'string' || typeof first === 'number') {
      return sanitizeProductCode(first);
    }
    if (first && typeof first === 'object') {
      return sanitizeProductCode(first.value ?? first.barcode ?? first.code);
    }
  }
  return null;
}

/** Extracts SKU / Articul / REGOS code from an item. */
export function extractRegosSku(item: Record<string, any>): string | null {
  const articul = sanitizeProductCode(
    item.sku ?? item.articul ?? item.article ?? item['Артикул'] ?? item['Artikul'],
  );
  if (articul) return articul;

  const code = item.code ?? item['Код'] ?? item.id;
  if (code !== undefined && code !== null && String(code).trim() !== '') {
    return sanitizeProductCode(`REG-${String(code).trim()}`);
  }
  return null;
}

/**
 * Normalizes a single REGOS `ItemExt` / `Item` or CSV/JSON import object into
 * a `NormalizedPosProduct`. Returns `null` if the item is marked deleted or has no name/code.
 */
export function normalizeRegosItem(
  raw: Record<string, any>,
  options: { priceInSom?: boolean } = { priceInSom: true },
): NormalizedPosProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.deleted === true || raw.is_deleted === true) return null;

  const priceInSom = options.priceInSom ?? true;
  const barcode = extractRegosBarcode(raw);
  const sku = extractRegosSku(raw);

  const rawName = String(
    raw.name_uz ??
      raw.name ??
      raw.fullname ??
      raw['Наименование'] ??
      raw['Nomi'] ??
      raw.title ??
      '',
  )
    .trim()
    .slice(0, 120);

  if (!rawName && !barcode && !sku) return null;

  const nameUz = rawName || sku || barcode || 'Mahsulot';
  const nameRu = String(raw.name_ru ?? raw.fullname ?? nameUz)
    .trim()
    .slice(0, 120);
  const nameEn = String(raw.name_en ?? nameUz)
    .trim()
    .slice(0, 120);

  const descriptionRaw = raw.description_uz ?? raw.description ?? raw.fullname ?? null;
  const descriptionUz =
    descriptionRaw && String(descriptionRaw).trim() && String(descriptionRaw).trim() !== nameUz
      ? String(descriptionRaw).trim().slice(0, 2000)
      : null;

  // Parse price: in REGOS, prices are in UZS (so'm). Convert to integer tiyin (1 so'm = 100 tiyin).
  const rawPriceVal =
    raw.price ??
    raw.retail_price ??
    raw['Цена'] ??
    raw['Narx'] ??
    raw['Narxi'] ??
    (Array.isArray(raw.prices) && raw.prices[0] ? raw.prices[0].value ?? raw.prices[0].price : 0);
  const parsedPrice = Number(String(rawPriceVal ?? 0).replace(/\s+/g, '').replace(',', '.'));
  const safePriceNum = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
  const priceTiyin = Math.min(
    MAX_PRODUCT_PRICE_TIYIN,
    Math.round(priceInSom ? safePriceNum * 100 : safePriceNum),
  );

  // Parse stock / quantity: REGOS quantities can be decimals (e.g. 12.5); floor to non-negative int.
  const rawStockVal =
    raw.stock ??
    raw.quantity ??
    raw.qty ??
    raw['Остаток'] ??
    raw['Кол-во'] ??
    raw['Qoldiq'] ??
    (Array.isArray(raw.quantities) && raw.quantities[0]
      ? raw.quantities[0].quantity ?? raw.quantities[0].common ?? raw.quantities[0].value
      : 0);
  const parsedStock = Number(String(rawStockVal ?? 0).replace(/\s+/g, '').replace(',', '.'));
  const stockInt = Number.isFinite(parsedStock)
    ? Math.min(MAX_PRODUCT_STOCK, Math.max(0, Math.floor(parsedStock)))
    : 0;

  const isAvailable =
    priceTiyin > 0 &&
    (raw.is_available !== undefined ? Boolean(raw.is_available) : stockInt > 0 || raw.quantity === undefined);

  const groupName =
    (raw.group && typeof raw.group === 'object' ? raw.group.name : null) ??
    raw.group_name ??
    raw.category_name ??
    raw.category ??
    raw['Группа'] ??
    raw['Kategoriya'] ??
    null;

  const imageUrl =
    typeof raw.image_url === 'string' && /^https?:\/\/|^\/uploads\//i.test(raw.image_url.trim())
      ? raw.image_url.trim()
      : null;

  return {
    barcode,
    sku,
    name_uz: nameUz,
    name_ru: nameRu,
    name_en: nameEn,
    description_uz: descriptionUz,
    price: priceTiyin,
    stock: stockInt,
    is_available: isAvailable,
    image_url: imageUrl,
    category_id: typeof raw.category_id === 'string' && raw.category_id.trim() ? raw.category_id.trim() : null,
    group_name: groupName ? String(groupName).trim() : null,
  };
}

/**
 * Matches a REGOS group/folder name to one of the platform categories using
 * exact or keyword matching in Uzbek, Russian, and English; falls back to `fallbackCategoryId`.
 */
export function matchCategoryId(
  groupName: string | null | undefined,
  categories: CategoryRef[],
  fallbackCategoryId: string,
): string {
  if (!categories.length) return fallbackCategoryId;
  const fallback = fallbackCategoryId || categories[0].id;
  if (!groupName) return fallback;

  const needle = groupName.trim().toLowerCase();
  if (!needle) return fallback;

  // 1. Direct or substring match against category names
  for (const cat of categories) {
    const names = [cat.name_uz, cat.name_ru, cat.name_en]
      .filter((v): v is string => !!v)
      .map((v) => v.toLowerCase());
    if (names.some((n) => n === needle || n.includes(needle) || needle.includes(n))) {
      return cat.id;
    }
  }

  // 2. Keyword heuristics for common REGOS product groups in Uzbekistan
  const keywords: { words: string[]; matchCat: string[] }[] = [
    { words: ['non', 'patir', 'buxanka', 'pishiriq', 'хлеб', 'выпеч', 'лепеш', 'bread', 'bakery'], matchCat: ['non', 'хлеб', 'bread'] },
    { words: ['sut', 'qaymoq', 'qatiq', 'tvorog', 'saryog', 'pishloq', 'tuxum', 'молок', 'молоч', 'сыр', 'яйц', 'dairy', 'milk'], matchCat: ['sut', 'молок', 'dairy'] },
    { words: ['ichimlik', 'suv', 'sharbat', 'kola', 'choy', 'qahva', 'напит', 'сок', 'вод', 'чай', 'drink', 'beverage'], matchCat: ['ichimlik', 'напит', 'beverage', 'drink'] },
    { words: ['meva', 'sabzavot', 'olma', 'banan', 'kartoshka', 'piyoz', 'овощ', 'фрукт', 'fruit', 'veg'], matchCat: ['meva', 'фрукт', 'fruit'] },
    { words: ['shirin', 'shokolad', 'konfet', 'pechenye', 'gazak', 'chips', 'сладост', 'конфет', 'шоколад', ' снек', 'sweet', 'snack'], matchCat: ['shirin', 'сладост', 'sweet'] },
  ];

  for (const rule of keywords) {
    if (rule.words.some((w) => needle.includes(w))) {
      const found = categories.find((c) => {
        const hay = `${c.name_uz} ${c.name_ru ?? ''} ${c.name_en ?? ''}`.toLowerCase();
        return rule.matchCat.some((m) => hay.includes(m));
      });
      if (found) return found.id;
    }
  }

  return fallback;
}

/** Splits a single CSV line respecting double-quoted fields. */
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

/**
 * Parses a CSV text exported from REGOS / 1C / Excel (supports `;`, `,`, or `\t` delimiters)
 * into an array of raw row objects ready for `normalizeRegosItem`.
 */
export function parseCsvCatalog(csvText: string): Record<string, string>[] {
  const cleaned = (csvText ?? '').replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  const delimiter = tabCount > semicolonCount && tabCount > commaCount ? '\t' : semicolonCount >= commaCount ? ';' : ',';

  const headers = splitCsvLine(headerLine, delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows: Record<string, string>[] = [];

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
