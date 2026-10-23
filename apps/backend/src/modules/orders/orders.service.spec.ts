import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrdersService, computeCommissionTiyin, percentToBasisPoints } from './orders.service';
import {
  ERROR_CODES,
  MAX_ORDER_TOTAL_TIYIN,
  ORDER_ACCEPTANCE_TIMEOUT_MS,
  OrderStatus,
  PaymentStatus,
  UserRole,
  isShopOpenNow,
} from '@localshop/shared';

describe('OrdersService', () => {
  let prisma: any;
  let gateway: any;
  let push: any;
  let payments: any;
  let queue: any;
  let service: OrdersService;

  // 00:00-23:59 keeps the opening-hours check independent of the wall clock in unit tests.
  const shop = {
    id: 'shop-1',
    owner_id: 'owner-1',
    is_active: true,
    is_open: true,
    open_time: '00:00',
    close_time: '23:59',
    status: 'active',
    commission_rate_percent: 0,
  };

  const createDto = () => ({
    address_text: 'addr',
    lat: 1,
    lng: 1,
    customer_phone: '+998900000000',
    payment_method: 'cash' as any,
  });

  const errorCode = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e: any) {
      return e.getResponse?.()?.code;
    }
    throw new Error('expected rejection');
  };

  beforeEach(() => {
    prisma = {
      cart: { findUnique: jest.fn(), delete: jest.fn() },
      cartItem: { deleteMany: jest.fn() },
      order: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      product: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      promoCode: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      payment: { create: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      orderReview: { create: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    gateway = { broadcastNewOrder: jest.fn(), broadcastOrderStatus: jest.fn(), broadcastOrderCancelled: jest.fn() };
    push = { sendNewOrderSellerPush: jest.fn(), sendOrderStatusPush: jest.fn() };
    payments = { isOnlinePaymentsEnabled: false, onlineProviderKey: 'payme' };
    queue = { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
    service = new OrdersService(prisma, gateway, push, payments, queue);
  });

  describe('createOrder', () => {
    const product = { id: 'p1', price: 100, stock: 5, is_available: true, deleted_at: null, name_uz: 'Non' };

    function mockCart(overrides: Record<string, any> = {}) {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        shop,
        items: [{ product_id: 'p1', quantity: 2, product }],
        ...overrides,
      });
    }

    it('schedules the retrying 10-minute hard auto-cancel job with the order id', async () => {
      mockCart();
      const createdOrder = { id: 'order-1', total_amount: 200, shop: { id: shop.id, owner_id: shop.owner_id } };
      prisma.order.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder('customer-1', createDto());

      expect(result).toBe(createdOrder);
      expect(queue.add).toHaveBeenCalledWith(
        'auto-cancel',
        { orderId: 'order-1' },
        expect.objectContaining({
          delay: ORDER_ACCEPTANCE_TIMEOUT_MS,
          jobId: 'order-1',
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnFail: 1000,
        }),
      );
    });

    it('reads the cart inside the transaction (same snapshot as the stock decrement)', async () => {
      mockCart();
      prisma.order.create.mockResolvedValue({ id: 'order-1', total_amount: 200, shop });

      await service.createOrder('customer-1', createDto());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txOrder = prisma.$transaction.mock.invocationCallOrder[0];
      expect(prisma.cart.findUnique.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
      expect(prisma.product.updateMany.mock.invocationCallOrder[0]).toBeGreaterThan(txOrder);
    });

    it('rejects when the shop is not active', async () => {
      mockCart({ shop: { ...shop, is_active: false } });
      await expect(service.createOrder('customer-1', createDto())).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects with SHOP_CLOSED when the manual switch is off', async () => {
      mockCart({ shop: { ...shop, is_open: false } });
      expect(await errorCode(service.createOrder('customer-1', createDto()))).toBe(ERROR_CODES.SHOP_CLOSED);
      expect(prisma.product.updateMany).not.toHaveBeenCalled();
    });

    it('rejects with SHOP_CLOSED outside the opening hours even when is_open is true', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-23T22:30:00.000Z')); // 03:30 Tashkent
      try {
        mockCart({ shop: { ...shop, open_time: '08:00', close_time: '22:00' } });
        expect(await errorCode(service.createOrder('customer-1', createDto()))).toBe(ERROR_CODES.SHOP_CLOSED);
        expect(prisma.product.updateMany).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('accepts an order inside the opening hours', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-23T07:00:00.000Z')); // 12:00 Tashkent
      try {
        mockCart({ shop: { ...shop, open_time: '08:00', close_time: '22:00' } });
        prisma.order.create.mockResolvedValue({ id: 'order-1', total_amount: 200, shop });
        await expect(service.createOrder('customer-1', createDto())).resolves.toBeDefined();
      } finally {
        jest.useRealTimers();
      }
    });

    it('rejects online payment with ONLINE_PAYMENTS_DISABLED before touching the cart', async () => {
      payments.isOnlinePaymentsEnabled = false;
      mockCart();

      expect(await errorCode(service.createOrder('customer-1', { ...createDto(), payment_method: 'online' as any }))).toBe(
        ERROR_CODES.ONLINE_PAYMENTS_DISABLED,
      );
      expect(prisma.cart.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('opens a pending Payment row in the order transaction when online payments are enabled', async () => {
      payments.isOnlinePaymentsEnabled = true;
      mockCart();
      prisma.order.create.mockResolvedValue({ id: 'order-1', total_amount: 200, shop });

      await service.createOrder('customer-1', { ...createDto(), payment_method: 'online' as any });

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: { order_id: 'order-1', provider: 'payme', amount: 200, status: PaymentStatus.PENDING },
      });
      expect(prisma.payment.create.mock.invocationCallOrder[0]).toBeGreaterThan(prisma.order.create.mock.invocationCallOrder[0]);
      expect(prisma.cart.delete.mock.invocationCallOrder[0]).toBeGreaterThan(prisma.payment.create.mock.invocationCallOrder[0]);
    });

    it('does not create a Payment row for cash orders', async () => {
      mockCart();
      prisma.order.create.mockResolvedValue({ id: 'order-1', total_amount: 200, shop });
      await service.createOrder('customer-1', createDto());
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects an order whose total would overflow int4', async () => {
      mockCart({ items: [{ product_id: 'p1', quantity: 3, product: { ...product, price: 1_000_000_000 } }] });

      expect(await errorCode(service.createOrder('customer-1', createDto()))).toBe(ERROR_CODES.ORDER_TOTAL_TOO_LARGE);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('accepts a total exactly at the int4 limit', async () => {
      mockCart({ items: [{ product_id: 'p1', quantity: 1, product: { ...product, price: MAX_ORDER_TOTAL_TIYIN } }] });
      prisma.order.create.mockResolvedValue({ id: 'order-1', total_amount: MAX_ORDER_TOTAL_TIYIN, shop });
      await expect(service.createOrder('customer-1', createDto())).resolves.toBeDefined();
    });

    it('stores the commission computed with integer basis-point math', async () => {
      mockCart({
        shop: { ...shop, commission_rate_percent: 2.675 },
        items: [{ product_id: 'p1', quantity: 1, product: { ...product, price: 10_000 } }],
      });
      prisma.order.create.mockImplementation(async ({ data }: any) => ({ id: 'order-1', total_amount: data.total_amount, shop, ...data }));

      await service.createOrder('customer-1', createDto());

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ total_amount: 10_000, commission_rate_percent: 2.675, commission_amount: 268 }),
        }),
      );
    });
  });

  describe('commission math (integer basis points)', () => {
    it('quantises the Float rate to basis points without float artefacts', () => {
      expect(percentToBasisPoints(2.5)).toBe(250);
      expect(percentToBasisPoints(2.675)).toBe(268);
      expect(percentToBasisPoints(1.005)).toBe(101); // naive Math.round(1.005 * 100) gives 100
      expect(percentToBasisPoints(0)).toBe(0);
      expect(percentToBasisPoints(100)).toBe(10_000);
    });

    it('computes 10 000 tiyin at 2.675 % as 268 tiyin', () => {
      expect(computeCommissionTiyin(10_000, 2.675)).toBe(268);
    });

    it('is integer x integer with one final division', () => {
      expect(computeCommissionTiyin(1_000_000, 1.15)).toBe(11_500);
      expect(computeCommissionTiyin(2_147_483_647, 10)).toBe(214_748_365);
      expect(computeCommissionTiyin(12345, 0)).toBe(0);
      expect(computeCommissionTiyin(12345, undefined as any)).toBe(0);
      expect(Number.isInteger(computeCommissionTiyin(999_999, 3.33))).toBe(true);
    });
  });

  describe('isShopOpenNow (shared helper, Tashkent UTC+5)', () => {
    const at = (iso: string) => new Date(iso);

    it('is closed whenever the manual switch is off', () => {
      expect(isShopOpenNow('00:00', '23:59', false, at('2026-10-23T07:00:00Z'))).toBe(false);
    });

    it('honours a same-day window inclusively', () => {
      expect(isShopOpenNow('08:00', '22:00', true, at('2026-10-23T03:00:00Z'))).toBe(true); // 08:00 local
      expect(isShopOpenNow('08:00', '22:00', true, at('2026-10-23T17:00:00Z'))).toBe(true); // 22:00 local
      expect(isShopOpenNow('08:00', '22:00', true, at('2026-10-23T17:01:00Z'))).toBe(false); // 22:01 local
      expect(isShopOpenNow('08:00', '22:00', true, at('2026-10-23T02:59:00Z'))).toBe(false); // 07:59 local
    });

    it('handles overnight windows', () => {
      expect(isShopOpenNow('20:00', '02:00', true, at('2026-10-23T18:30:00Z'))).toBe(true); // 23:30 local
      expect(isShopOpenNow('20:00', '02:00', true, at('2026-10-23T20:30:00Z'))).toBe(true); // 01:30 local
      expect(isShopOpenNow('20:00', '02:00', true, at('2026-10-23T07:00:00Z'))).toBe(false); // 12:00 local
    });

    it('falls back to 08:00-22:00 when times are empty', () => {
      expect(isShopOpenNow('', null, true, at('2026-10-23T07:00:00Z'))).toBe(true);
      expect(isShopOpenNow(undefined, undefined, true, at('2026-10-23T22:00:00Z'))).toBe(false); // 03:00 local
    });
  });

  describe('reviewOrder', () => {
    const delivered = { id: 'order-1', customer_id: 'customer-1', status: OrderStatus.DELIVERED, review: null };

    it('stores a review for the customer own delivered order', async () => {
      prisma.order.findUnique.mockResolvedValue(delivered);
      prisma.orderReview.create.mockImplementation(async ({ data }: any) => ({ id: 'rev-1', ...data }));

      const result = await service.reviewOrder('order-1', 'customer-1', { stars: 5, comment: '  Zo\'r!  ' });

      expect(prisma.orderReview.create).toHaveBeenCalledWith({
        data: { order_id: 'order-1', customer_id: 'customer-1', stars: 5, comment: 'Zo\'r!' },
      });
      expect(result.stars).toBe(5);
    });

    it('rejects orders that are not delivered yet', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...delivered, status: OrderStatus.ON_THE_WAY });
      await expect(service.reviewOrder('order-1', 'customer-1', { stars: 4 })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.orderReview.create).not.toHaveBeenCalled();
    });

    it('rejects a second review of the same order', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...delivered, review: { stars: 3 } });
      await expect(service.reviewOrder('order-1', 'customer-1', { stars: 4 })).rejects.toBeInstanceOf(ConflictException);
    });

    it("refuses another customer's order", async () => {
      prisma.order.findUnique.mockResolvedValue({ ...delivered, customer_id: 'someone-else' });
      await expect(service.reviewOrder('order-1', 'customer-1', { stars: 4 })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  function mockOrder(status: OrderStatus, extra: Record<string, any> = {}) {
    return {
      id: 'order-1',
      status,
      customer_id: 'customer-1',
      shop_id: 'shop-1',
      shop: { ...shop },
      items: [{ product_id: 'p1', quantity: 1 }],
      payment_method: 'cash',
      promo_code: null,
      ...extra,
    };
  }

  describe('transitionOrder (via acceptOrder/rejectOrder/updateStatus/cancelOrder)', () => {
    it('allows the seller to accept a NEW order with a status-guarded update and clears the auto-cancel job', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW));
      const reloaded = { ...mockOrder(OrderStatus.ACCEPTED), status_history: [{ status: 'new' }, { status: 'accepted' }] };
      prisma.order.findUniqueOrThrow.mockResolvedValue(reloaded);

      const result = await service.acceptOrder('order-1', 'owner-1');

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', status: OrderStatus.NEW },
        data: expect.objectContaining({ status: OrderStatus.ACCEPTED, accepted_at: expect.any(Date) }),
      });
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { order_id: 'order-1', status: OrderStatus.ACCEPTED, changed_by: 'owner-1', reason: null },
      });
      // Reloaded after the history insert so the new row is part of the response.
      expect(prisma.order.findUniqueOrThrow.mock.invocationCallOrder[0]).toBeGreaterThan(
        prisma.orderStatusHistory.create.mock.invocationCallOrder[0],
      );
      expect(prisma.order.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-1' }, include: expect.objectContaining({ status_history: true, items: true }) }),
      );
      expect(result).toBe(reloaded);
      expect(queue.remove).toHaveBeenCalledWith('order-1');
    });

    it('throws 409 and touches neither stock nor history when the status changed concurrently', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW));
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      expect(await errorCode(service.cancelOrder('order-1', 'customer-1', UserRole.CUSTOMER, {} as any))).toBe(
        ERROR_CODES.INVALID_STATUS_TRANSITION,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.promoCode.updateMany).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(prisma.order.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(gateway.broadcastOrderStatus).not.toHaveBeenCalled();
      expect(push.sendOrderStatusPush).not.toHaveBeenCalled();
    });

    it('restores stock exactly once, after the guarded update, when the customer cancels', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW, { items: [{ product_id: 'p1', quantity: 3 }] }));
      prisma.order.findUniqueOrThrow.mockResolvedValue(mockOrder(OrderStatus.CANCELLED));

      await service.cancelOrder('order-1', 'customer-1', UserRole.CUSTOMER, { reason: 'changed my mind' });

      expect(prisma.product.update).toHaveBeenCalledTimes(1);
      expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { stock: { increment: 3 } } });
      expect(prisma.product.update.mock.invocationCallOrder[0]).toBeGreaterThan(prisma.order.updateMany.mock.invocationCallOrder[0]);
      expect(prisma.promoCode.updateMany).not.toHaveBeenCalled();
      expect(queue.remove).toHaveBeenCalledWith('order-1');
    });

    it('gives the promo redemption back when a promo order is cancelled', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW, { promo_code: 'YANGI10' }));
      prisma.order.findUniqueOrThrow.mockResolvedValue(mockOrder(OrderStatus.CANCELLED));

      await service.rejectOrder('order-1', 'owner-1', { reason: 'Mahsulot tugadi' });

      expect(prisma.promoCode.updateMany).toHaveBeenCalledWith({
        where: { code: 'YANGI10', usage_count: { gt: 0 } },
        data: { usage_count: { decrement: 1 } },
      });
    });

    it('does not restore stock on a forward transition', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.ACCEPTED));
      prisma.order.findUniqueOrThrow.mockResolvedValue(mockOrder(OrderStatus.ON_THE_WAY));

      await service.updateStatus('order-1', 'owner-1', { status: OrderStatus.ON_THE_WAY } as any);

      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(queue.remove).not.toHaveBeenCalled();
    });

    it('marks cash orders paid on delivery', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.ON_THE_WAY));
      prisma.order.findUniqueOrThrow.mockResolvedValue(mockOrder(OrderStatus.DELIVERED));

      await service.updateStatus('order-1', 'owner-1', { status: OrderStatus.DELIVERED } as any);

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', status: OrderStatus.ON_THE_WAY },
        data: expect.objectContaining({ status: OrderStatus.DELIVERED, payment_status: PaymentStatus.PAID, delivered_at: expect.any(Date) }),
      });
    });

    it('rejects a seller trying to act on another shop\'s order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW));
      await expect(service.acceptOrder('order-1', 'someone-else')).rejects.toThrow();
    });

    it('requires a reason when the seller rejects an order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW));
      await expect(service.rejectOrder('order-1', 'owner-1', { reason: '' } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('requires a reason when the seller cancels via the generic cancel route (no silent default)', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.ACCEPTED));

      expect(await errorCode(service.cancelOrder('order-1', 'owner-1', UserRole.SELLER, {} as any))).toBe('REASON_REQUIRED');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lets the customer cancel without a reason while new', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW));
      prisma.order.findUniqueOrThrow.mockResolvedValue(mockOrder(OrderStatus.CANCELLED));

      await service.cancelOrder('order-1', 'customer-1', UserRole.CUSTOMER, {} as any);

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: OrderStatus.CANCELLED, changed_by: 'customer-1', reason: null }),
      });
    });

    it('does not let a seller cancel once the order is on the way (admins only)', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.ON_THE_WAY));
      await expect(
        service.cancelOrder('order-1', 'owner-1', UserRole.SELLER, { reason: 'late' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an illegal transition (accepted -> delivered, skipping on_the_way)', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.ACCEPTED));
      await expect(
        service.updateStatus('order-1', 'owner-1', { status: OrderStatus.DELIVERED } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('prevents a customer from cancelling once the order has been accepted', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.ACCEPTED));
      await expect(
        service.cancelOrder('order-1', 'customer-1', UserRole.CUSTOMER, {} as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('adminCancelOrder', () => {
    it.each([OrderStatus.NEW, OrderStatus.ACCEPTED, OrderStatus.ON_THE_WAY])(
      'cancels from %s (per the shared transition tables), restoring stock and promo',
      async (status) => {
        prisma.order.findUnique.mockResolvedValue(mockOrder(status, { promo_code: 'YANGI10', items: [{ product_id: 'p1', quantity: 2 }] }));

        const result = await service.adminCancelOrder('order-1', 'admin-1', '  customer unreachable ');

        expect(result).toEqual({ id: 'order-1' });
        expect(prisma.order.updateMany).toHaveBeenCalledWith({
          where: { id: 'order-1', status },
          data: { status: OrderStatus.CANCELLED, needs_attention: false },
        });
        expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { stock: { increment: 2 } } });
        expect(prisma.promoCode.updateMany).toHaveBeenCalledWith({
          where: { code: 'YANGI10', usage_count: { gt: 0 } },
          data: { usage_count: { decrement: 1 } },
        });
        expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
          data: { order_id: 'order-1', status: OrderStatus.CANCELLED, changed_by: 'admin-1', reason: 'customer unreachable' },
        });
        expect(gateway.broadcastOrderCancelled).toHaveBeenCalledWith('shop-1', 'order-1', 'customer unreachable');
      },
    );

    it('drops the pending auto-cancel job only when cancelling from new', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW));
      await service.adminCancelOrder('order-1', 'admin-1', 'x');
      expect(queue.remove).toHaveBeenCalledWith('order-1');

      queue.remove.mockClear();
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.ACCEPTED));
      await service.adminCancelOrder('order-1', 'admin-1', 'x');
      expect(queue.remove).not.toHaveBeenCalled();
    });

    it.each([OrderStatus.DELIVERED, OrderStatus.CANCELLED])('refuses final status %s', async (status) => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(status));

      expect(await errorCode(service.adminCancelOrder('order-1', 'admin-1', 'x'))).toBe('ORDER_NOT_CANCELLABLE');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws 409 and restores nothing when it loses the race', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW, { promo_code: 'YANGI10' }));
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.adminCancelOrder('order-1', 'admin-1', 'x')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.promoCode.updateMany).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(gateway.broadcastOrderCancelled).not.toHaveBeenCalled();
    });
  });
});
