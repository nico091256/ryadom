import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_REGOS_ITEMS,
  matchCategoryId,
  normalizeRegosItem,
  parseCsvCatalog,
  resolveRegosGatewayUrl,
  sanitizeProductCode,
} from './regos.util';

test('resolveRegosGatewayUrl normalizes bare keys, full URLs, and demo keys', () => {
  assert.equal(resolveRegosGatewayUrl('demo'), 'demo');
  assert.equal(resolveRegosGatewayUrl('demo_regos_1'), 'demo');
  assert.equal(
    resolveRegosGatewayUrl('abc123token'),
    'https://integration.regos.uz/gateway/out/abc123token/v1',
  );
  assert.equal(
    resolveRegosGatewayUrl('https://integration.regos.uz/gateway/out/my-key-99/v1/item/getext'),
    'https://integration.regos.uz/gateway/out/my-key-99/v1',
  );
});

test('sanitizeProductCode cleans barcodes and SKUs to valid format', () => {
  assert.equal(sanitizeProductCode(' 4780010010018 '), '4780010010018');
  assert.equal(sanitizeProductCode('REG SHT 01'), 'REG-SHT-01');
  assert.equal(sanitizeProductCode('---abc_123'), 'abc_123');
  assert.equal(sanitizeProductCode(''), null);
});

test('normalizeRegosItem converts REGOS ItemExt record (som -> tiyin, barcodes, stock)', () => {
  const item = normalizeRegosItem(
    {
      id: 505,
      code: 1020,
      articul: 'MLK-25',
      barcodes: [{ value: '4780000099991' }],
      name: 'Lactel Sut 2.5%',
      fullname: 'Lactel tabiiy sut 2.5% 1L',
      price: 14500,
      quantity: 19.8,
      group: { id: 2, name: 'Sut va sut mahsulotlari' },
    },
    { priceInSom: true },
  );

  assert.ok(item);
  assert.equal(item.barcode, '4780000099991');
  assert.equal(item.sku, 'MLK-25');
  assert.equal(item.name_uz, 'Lactel Sut 2.5%');
  assert.equal(item.price, 1450000); // 14 500 so'm = 1 450 000 tiyin
  assert.equal(item.stock, 19);
  assert.equal(item.group_name, 'Sut va sut mahsulotlari');
  assert.equal(item.is_available, true);
});

test('normalizeRegosItem skips deleted items', () => {
  assert.equal(normalizeRegosItem({ id: 1, name: 'Deleted', deleted: true }), null);
});

test('matchCategoryId matches Uzbek/Russian/English group names and keywords', () => {
  const categories = [
    { id: 'c-1', name_uz: 'Non va pishiriqlar', name_ru: 'Хлеб и выпечка', name_en: 'Bakery' },
    { id: 'c-2', name_uz: 'Sut va sut mahsulotlari', name_ru: 'Молочные продукты', name_en: 'Dairy' },
    { id: 'c-3', name_uz: 'Ichimliklar va sharbatlar', name_ru: 'Напитки и соки', name_en: 'Drinks' },
  ];

  assert.equal(matchCategoryId('Молочные продукты', categories, 'c-1'), 'c-2');
  assert.equal(matchCategoryId('Salqin ichimliklar', categories, 'c-1'), 'c-3');
  assert.equal(matchCategoryId('Noma`lum guruh', categories, 'c-1'), 'c-1');
});

test('parseCsvCatalog parses semicolon-delimited REGOS CSV export and normalizes rows', () => {
  const csv = [
    'Код;Артикул;Штрихкод;Наименование;Цена;Остаток;Группа',
    '101;ART-01;4780001112223;"Issiq patir non";7500;25;"Non va pishiriqlar"',
    '102;ART-02;4780001112230;"Musaffo Sut 1L";13500;14;"Молочные продукты"',
  ].join('\n');

  const rows = parseCsvCatalog(csv);
  assert.equal(rows.length, 2);

  const first = normalizeRegosItem(rows[0], { priceInSom: true });
  assert.ok(first);
  assert.equal(first.barcode, '4780001112223');
  assert.equal(first.sku, 'ART-01');
  assert.equal(first.name_uz, 'Issiq patir non');
  assert.equal(first.price, 750000);
  assert.equal(first.stock, 25);
  assert.equal(first.group_name, 'Non va pishiriqlar');
});

test('DEMO_REGOS_ITEMS all normalize cleanly', () => {
  const normalized = DEMO_REGOS_ITEMS.map((i) => normalizeRegosItem(i, { priceInSom: true })).filter(Boolean);
  assert.equal(normalized.length, DEMO_REGOS_ITEMS.length);
});
