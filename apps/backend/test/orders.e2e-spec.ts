import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { OrderAutoCancelProcessor } from '../src/modules/orders/order-auto-cancel.processor';

/**
 * Full order lifecycle against a real Postgres+Redis stack:
 * create -> accept -> on_the_way -> delivered, plus the 10-minute hard
 * auto-cancel path (exercised directly against the BullMQ processor rather
 * than waiting out the real delay) and Idempotency-Key deduplication.
 */
describe('Orders lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = (path: string) => `/api/v1${path}`;

  let cityId: string;
  let shopId: string;
  let categoryId: string;
  let productId: string;
  let sellerLogin: string;
  let sellerPassword: string;
  let customerPhone: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.init();

    prisma = app.get(PrismaService);

    const city = await prisma.city.create({
      data: { name_uz: 'Toshkent-e2e', name_ru: 'Ташкент-e2e', name_en: 'Tashkent-e2e', is_active: true },
    });
    cityId = city.id;

    sellerLogin = `seller_e2e_${randomUUID().slice(0, 8)}`;
    sellerPassword = 'E2eSellerPass123!';
    const seller = await prisma.user.create({
      data: {
        login: sellerLogin,
        phone: '+998900000001',
        name: 'E2E Seller',
        password_hash: await bcrypt.hash(sellerPassword, 10),
        role: 'seller' as any,
        must_change_password: false,
        is_blocked: false,
      },
    });

    const shop = await prisma.shop.create({
      data: {
        owner_id: seller.id,
        city_id: cityId,
        name: 'E2E Test Shop',
        phone: '+998900000001',
        address_text: 'Test address',
        lat: 41.2995,
        lng: 69.2401,
        open_time: '00:00',
        close_time: '23:59',
        is_open: true,
        is_active: true,
        status: 'active' as any,
        commission_rate_percent: 0,
      },
    });
    shopId = shop.id;

    const category = await prisma.category.create({
      data: { name_uz: 'E2E kategoriya', name_ru: 'E2E категория', name_en: 'E2E category' },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        shop_id: shopId,
        category_id: categoryId,
        name_uz: 'Test mahsulot',
        name_ru: 'Тест продукт',
        name_en: 'Test product',
        price: 500000,
        stock: 10,
        is_available: true,
      },
    });
    productId = product.id;

    customerPhone = '+998900000002';
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginCustomer(phone: string): Promise<string> {
    await request(app.getHttpServer()).post(api('/auth/send-code')).send({ phone }).expect(200);
    const verify = await request(app.getHttpServer())
      .post(api('/auth/verify'))
      .send({ phone, code: '123456' })
      .expect(200);
    return verify.body.accessToken;
  }

  async function loginSeller(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ login: sellerLogin, password: sellerPassword })
      .expect(200);
    return res.body.accessToken;
  }

  async function addToCart(customerToken: string, quantity = 1) {
    await request(app.getHttpServer())
      .put(api('/cart'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shop_id: shopId, items: [{ product_id: productId, quantity }] })
      .expect(200);
  }

  it('runs the full happy-path lifecycle: new -> accepted -> on_the_way -> delivered', async () => {
    const customerToken = await loginCustomer(customerPhone);
    const sellerToken = await loginSeller();

    await addToCart(customerToken, 2);

    const createRes = await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        address_text: 'Toshkent, test manzil',
        lat: 41.3,
        lng: 69.24,
        customer_phone: customerPhone,
        payment_method: 'cash',
      })
      .expect(201);

    const orderId = createRes.body.id;
    expect(createRes.body.status).toBe('new');

    await request(app.getHttpServer())
      .post(api(`/orders/${orderId}/accept`))
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('accepted'));

    await request(app.getHttpServer())
      .patch(api(`/orders/${orderId}/status`))
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'on_the_way' })
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('on_the_way'));

    const deliveredRes = await request(app.getHttpServer())
      .patch(api(`/orders/${orderId}/status`))
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'delivered' })
      .expect(200);

    expect(deliveredRes.body.status).toBe('delivered');
    expect(deliveredRes.body.payment_status).toBe('paid');

    const detail = await request(app.getHttpServer())
      .get(api(`/orders/${orderId}`))
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    const statuses = detail.body.status_history.map((h: any) => h.status);
    expect(statuses).toEqual(['new', 'accepted', 'on_the_way', 'delivered']);
  });

  it('rejects skipping a state (e.g. new -> on_the_way)', async () => {
    const customerToken = await loginCustomer(customerPhone);
    const sellerToken = await loginSeller();
    await addToCart(customerToken, 1);

    const createRes = await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ address_text: 'addr', lat: 41.3, lng: 69.24, customer_phone: customerPhone, payment_method: 'cash' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(api(`/orders/${createRes.body.id}/status`))
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'on_the_way' })
      .expect(409);
  });

  it('auto-cancels and restores stock when the acceptance window elapses', async () => {
    const customerToken = await loginCustomer(customerPhone);
    await addToCart(customerToken, 3);

    const productBefore = await prisma.product.findUnique({ where: { id: productId } });

    const createRes = await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ address_text: 'addr', lat: 41.3, lng: 69.24, customer_phone: customerPhone, payment_method: 'cash' })
      .expect(201);
    const orderId = createRes.body.id;

    // Simulate the BullMQ delayed job firing, instead of waiting out the real 10-minute delay.
    const processor = app.get(OrderAutoCancelProcessor);
    await processor.process({ data: { orderId } } as any);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('cancelled');

    const productAfter = await prisma.product.findUnique({ where: { id: productId } });
    expect(productAfter?.stock).toBe((productBefore?.stock ?? 0) - 3 + 3);
  });

  it('rolls back the whole order when a later item is out of stock (first item stock untouched)', async () => {
    const customerToken = await loginCustomer(customerPhone);

    const second = await prisma.product.create({
      data: {
        shop_id: shopId,
        category_id: categoryId,
        name_uz: 'Ikkinchi mahsulot',
        name_ru: 'Второй продукт',
        name_en: 'Second product',
        price: 250000,
        stock: 5,
        is_available: true,
      },
    });

    // Cart validation passes (both in stock) ...
    await request(app.getHttpServer())
      .put(api('/cart'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shop_id: shopId, items: [{ product_id: productId, quantity: 1 }, { product_id: second.id, quantity: 2 }] })
      .expect(200);

    // ... then the second product sells out before checkout.
    await prisma.product.update({ where: { id: second.id }, data: { stock: 0 } });
    const firstBefore = await prisma.product.findUnique({ where: { id: productId } });
    const ordersBefore = await prisma.order.count();

    await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ address_text: 'addr', lat: 41.3, lng: 69.24, customer_phone: customerPhone, payment_method: 'cash' })
      .expect(409)
      .expect((res) => expect(res.body.code).toBe('OUT_OF_STOCK'));

    // Whichever item was processed first, the transaction rolled back: no stock moved, no order row.
    const firstAfter = await prisma.product.findUnique({ where: { id: productId } });
    expect(firstAfter?.stock).toBe(firstBefore?.stock);
    expect((await prisma.product.findUnique({ where: { id: second.id } }))?.stock).toBe(0);
    expect(await prisma.order.count()).toBe(ordersBefore);

    // The cart survives a failed checkout; clear it so later cases start clean.
    await request(app.getHttpServer()).delete(api('/cart')).set('Authorization', `Bearer ${customerToken}`);
  });

  it('restores stock exactly once when the customer double-cancels concurrently', async () => {
    const customerToken = await loginCustomer(customerPhone);
    const stockBefore = (await prisma.product.findUnique({ where: { id: productId } }))?.stock ?? 0;

    await addToCart(customerToken, 2);
    const createRes = await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ address_text: 'addr', lat: 41.3, lng: 69.24, customer_phone: customerPhone, payment_method: 'cash' })
      .expect(201);
    const orderId = createRes.body.id;
    expect((await prisma.product.findUnique({ where: { id: productId } }))?.stock).toBe(stockBefore - 2);

    const cancel = () =>
      request(app.getHttpServer())
        .post(api(`/orders/${orderId}/cancel`))
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'double tap' });
    const [a, b] = await Promise.all([cancel(), cancel()]);

    // One wins (200), the other loses the status-guarded update (409) - never two successes.
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { status_history: true } });
    expect(order?.status).toBe('cancelled');
    expect(order?.status_history.filter((h) => h.status === ('cancelled' as any))).toHaveLength(1);
    expect((await prisma.product.findUnique({ where: { id: productId } }))?.stock).toBe(stockBefore);
  });

  it('deduplicates order creation via Idempotency-Key', async () => {
    const customerToken = await loginCustomer(customerPhone);
    await addToCart(customerToken, 1);

    const key = randomUUID();
    const payload = { address_text: 'addr', lat: 41.3, lng: 69.24, customer_phone: customerPhone, payment_method: 'cash' };

    const first = await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    // Cart was cleared by the first request; a genuinely new POST would now fail
    // with CART_EMPTY, so a second success with the SAME body proves the
    // response was served from the idempotency cache rather than re-executed.
    const second = await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    // Same key, different body: refused instead of replaying an unrelated response.
    await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send({ ...payload, address_text: 'another address' })
      .expect(422);
  });

  it('writes a system history row (changed_by = null) when the processor auto-cancels', async () => {
    const customerToken = await loginCustomer(customerPhone);
    await addToCart(customerToken, 1);

    const createRes = await request(app.getHttpServer())
      .post(api('/orders'))
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ address_text: 'addr', lat: 41.3, lng: 69.24, customer_phone: customerPhone, payment_method: 'cash' })
      .expect(201);

    await app.get(OrderAutoCancelProcessor).process({ data: { orderId: createRes.body.id } } as any);

    const history = await prisma.orderStatusHistory.findMany({ where: { order_id: createRes.body.id }, orderBy: { created_at: 'asc' } });
    expect(history.map((h) => h.status)).toEqual(['new', 'cancelled']);
    expect(history[1].changed_by).toBeNull();
  });
});
