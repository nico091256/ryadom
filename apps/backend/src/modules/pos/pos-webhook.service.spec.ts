import { createHmac } from 'crypto';
import { isSafeWebhookUrl, PosWebhookService } from './pos-webhook.service';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('isSafeWebhookUrl', () => {
  it.each([
    'https://kassa.example.uz/ryadom/webhook',
    'http://pos.shop-chain.com:8080/hook',
    'https://203.0.113.10/webhook',
  ])('accepts a public http(s) target: %s', (url) => {
    expect(isSafeWebhookUrl(url)).toBe(true);
  });

  it.each([
    'ftp://kassa.example.uz/hook',
    'not a url',
    'http://localhost:4000/hook',
    'http://api.localhost/hook',
    'http://127.0.0.1/hook',
    'http://10.0.0.5/hook',
    'http://192.168.1.20/hook',
    'http://172.16.3.3/hook',
    'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1/hook',
    'http://[::1]/hook',
    'http://postgis.railway.internal/hook',
  ])('rejects private / loopback / non-http targets: %s', (url) => {
    expect(isSafeWebhookUrl(url)).toBe(false);
  });
});

describe('PosWebhookService', () => {
  const order = {
    id: 'o-1',
    status: 'new',
    payment_method: 'cash',
    payment_status: 'pending',
    total_amount: 2100000,
    discount_amount: 0,
    promo_code: null,
    comment: "Eshik qo'ng'irog'ini chaling",
    customer_phone: '+998901234567',
    customer: { id: 'u-1', name: 'Sardor' },
    address_snapshot: { lat: 41.28, lng: 69.21, text: 'Chilonzor 5' },
    items: [{ product_id: 'p-1', product_name: 'Non', unit_price: 800000, quantity: 2, id: 'oi-1', order_id: 'o-1' }],
    created_at: new Date('2026-10-31T08:00:00Z'),
  };

  let prisma: any;
  let fetchMock: jest.Mock;
  const realFetch = global.fetch;

  beforeEach(() => {
    prisma = { shop: { findUnique: jest.fn() } };
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as any;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('shapes the order into the shop-side payload without customer ids', () => {
    const payload = PosWebhookService.toOrderPayload(order);
    expect(payload).toEqual({
      id: 'o-1',
      status: 'new',
      payment_method: 'cash',
      payment_status: 'pending',
      total_amount: 2100000,
      discount_amount: 0,
      promo_code: null,
      comment: "Eshik qo'ng'irog'ini chaling",
      customer_phone: '+998901234567',
      customer_name: 'Sardor',
      address: { lat: 41.28, lng: 69.21, text: 'Chilonzor 5' },
      items: [{ product_id: 'p-1', product_name: 'Non', unit_price: 800000, quantity: 2 }],
      created_at: '2026-10-31T08:00:00.000Z',
    });
    expect(JSON.stringify(payload)).not.toContain('u-1');
  });

  it('does nothing when the shop has no webhook url', async () => {
    prisma.shop.findUnique.mockResolvedValue({ pos_webhook_url: null, pos_api_key: 'rk_pos_x', pos_type: '1c' });
    new PosWebhookService(prisma).dispatchNewOrder('s-1', order);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to call a private network target', async () => {
    prisma.shop.findUnique.mockResolvedValue({ pos_webhook_url: 'http://10.0.0.9/hook', pos_api_key: null, pos_type: 'custom' });
    new PosWebhookService(prisma).dispatchNewOrder('s-1', order);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs the signed event to the shop webhook', async () => {
    prisma.shop.findUnique.mockResolvedValue({
      pos_webhook_url: 'https://kassa.example.uz/hook',
      pos_api_key: 'rk_pos_secret',
      pos_type: 'jowi',
    });
    new PosWebhookService(prisma).dispatchNewOrder('s-1', order);
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://kassa.example.uz/hook');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers['x-ryadom-event']).toBe('order.created');

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ event: 'order.created', shop_id: 's-1', pos_type: 'jowi' });
    expect(body.data.id).toBe('o-1');

    const expected = `sha256=${createHmac('sha256', 'rk_pos_secret').update(init.body).digest('hex')}`;
    expect(init.headers['x-ryadom-signature']).toBe(expected);
  });

  it('never throws when the receiver is down', async () => {
    prisma.shop.findUnique.mockResolvedValue({ pos_webhook_url: 'https://kassa.example.uz/hook', pos_api_key: null, pos_type: 'custom' });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(() => new PosWebhookService(prisma).dispatchNewOrder('s-1', order)).not.toThrow();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
