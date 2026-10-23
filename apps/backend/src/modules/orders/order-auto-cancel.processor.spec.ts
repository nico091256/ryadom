import { ORDER_ACCEPTANCE_TIMEOUT_MS, OrderStatus } from '@localshop/shared';
import { AUTO_CANCEL_REASON, OrderAutoCancelProcessor, STALE_ORDER_SWEEP_BATCH } from './order-auto-cancel.processor';

describe('OrderAutoCancelProcessor', () => {
  let prisma: any;
  let gateway: any;
  let push: any;
  let processor: OrderAutoCancelProcessor;

  const newOrder = (id: string, extra: Record<string, any> = {}) => ({
    id,
    status: OrderStatus.NEW,
    customer_id: 'customer-1',
    shop_id: 'shop-1',
    shop: { id: 'shop-1', owner_id: 'owner-1' },
    items: [{ product_id: 'p1', quantity: 2 }],
    promo_code: null,
    ...extra,
  });

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      product: { update: jest.fn() },
      promoCode: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    gateway = { broadcastOrderStatus: jest.fn(), broadcastOrderCancelled: jest.fn() };
    push = { sendOrderStatusPush: jest.fn() };
    processor = new OrderAutoCancelProcessor(prisma, gateway, push);
  });

  describe('process (delayed BullMQ job)', () => {
    it('cancels a still-new order, restores stock, writes a system history row and notifies both sides', async () => {
      prisma.order.findUnique.mockResolvedValue(newOrder('order-1'));

      await processor.process({ data: { orderId: 'order-1' } } as any);

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', status: OrderStatus.NEW },
        data: { status: OrderStatus.CANCELLED, needs_attention: true },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { stock: { increment: 2 } } });
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { order_id: 'order-1', status: OrderStatus.CANCELLED, changed_by: null, reason: AUTO_CANCEL_REASON },
      });
      expect(prisma.promoCode.updateMany).not.toHaveBeenCalled();
      expect(gateway.broadcastOrderStatus).toHaveBeenCalledWith('order-1', 'customer-1', OrderStatus.CANCELLED, expect.any(String));
      expect(gateway.broadcastOrderCancelled).toHaveBeenCalledWith('shop-1', 'order-1', AUTO_CANCEL_REASON);
      expect(push.sendOrderStatusPush).toHaveBeenCalledTimes(2);
    });

    it('gives back the promo redemption when the order used a promo code', async () => {
      prisma.order.findUnique.mockResolvedValue(newOrder('order-1', { promo_code: 'YANGI10' }));

      await processor.process({ data: { orderId: 'order-1' } } as any);

      expect(prisma.promoCode.updateMany).toHaveBeenCalledWith({
        where: { code: 'YANGI10', usage_count: { gt: 0 } },
        data: { usage_count: { decrement: 1 } },
      });
    });

    it('does nothing when the order already left "new"', async () => {
      prisma.order.findUnique.mockResolvedValue(newOrder('order-1', { status: OrderStatus.ACCEPTED }));

      await processor.process({ data: { orderId: 'order-1' } } as any);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(gateway.broadcastOrderStatus).not.toHaveBeenCalled();
    });

    it('does not restore stock or notify when the conditional update loses the race', async () => {
      prisma.order.findUnique.mockResolvedValue(newOrder('order-1'));
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await processor.process({ data: { orderId: 'order-1' } } as any);

      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(gateway.broadcastOrderStatus).not.toHaveBeenCalled();
      expect(push.sendOrderStatusPush).not.toHaveBeenCalled();
    });
  });

  describe('sweepStaleNewOrders (per-minute safety net)', () => {
    const now = new Date('2026-10-23T10:00:00.000Z');

    it('queries only new orders older than the acceptance window, oldest first, in a bounded batch', async () => {
      const cancelled = await processor.sweepStaleNewOrders(now);

      expect(cancelled).toBe(0);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { status: OrderStatus.NEW, created_at: { lt: new Date(now.getTime() - ORDER_ACCEPTANCE_TIMEOUT_MS) } },
        select: { id: true },
        orderBy: { created_at: 'asc' },
        take: STALE_ORDER_SWEEP_BATCH,
      });
      expect(prisma.order.findUnique).not.toHaveBeenCalled();
    });

    it('cancels each stale order through the same guarded path and counts the ones it cancelled', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o-1' }, { id: 'o-2' }, { id: 'o-3' }]);
      prisma.order.findUnique.mockImplementation(async ({ where }: any) =>
        where.id === 'o-2' ? newOrder('o-2', { status: OrderStatus.ACCEPTED }) : newOrder(where.id),
      );

      const cancelled = await processor.sweepStaleNewOrders(now);

      expect(cancelled).toBe(2);
      expect(prisma.order.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.order.updateMany.mock.calls.map((c: any[]) => c[0].where.id)).toEqual(['o-1', 'o-3']);
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledTimes(2);
    });

    it('keeps going when one order throws so the rest of the batch is still handled', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o-1' }, { id: 'o-2' }]);
      prisma.order.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'o-1') throw new Error('db hiccup');
        return newOrder(where.id);
      });

      const cancelled = await processor.sweepStaleNewOrders(now);

      expect(cancelled).toBe(1);
      expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o-2', status: OrderStatus.NEW } }));
    });
  });

  it('onFailed logs the job id, order id, attempt and error without throwing', () => {
    const errorSpy = jest.spyOn((processor as any).logger, 'error').mockImplementation(() => undefined);

    processor.onFailed({ id: 'order-9', data: { orderId: 'order-9' }, attemptsMade: 2, opts: { attempts: 5 } } as any, new Error('boom'));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('order-9'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('attempt 2/5'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });
});
