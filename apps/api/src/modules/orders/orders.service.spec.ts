import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ORDER_ACCEPTANCE_TIMEOUT_MS, OrderStatus, UserRole } from '@localshop/shared';

describe('OrdersService', () => {
  let prisma: any;
  let gateway: any;
  let push: any;
  let payments: any;
  let queue: any;
  let service: OrdersService;

  const shop = { id: 'shop-1', owner_id: 'owner-1', is_active: true, is_open: true, status: 'active', commission_rate_percent: 0 };

  beforeEach(() => {
    prisma = {
      cart: { findUnique: jest.fn(), delete: jest.fn() },
      cartItem: { deleteMany: jest.fn() },
      order: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      product: { findUnique: jest.fn(), update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    gateway = { broadcastNewOrder: jest.fn(), broadcastOrderStatus: jest.fn(), broadcastOrderCancelled: jest.fn() };
    push = { sendNewOrderSellerPush: jest.fn(), sendOrderStatusPush: jest.fn() };
    payments = {};
    queue = { add: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
    service = new OrdersService(prisma, gateway, push, payments, queue);
  });

  describe('createOrder', () => {
    it('schedules the 10-minute hard auto-cancel job with the order id', async () => {
      const product = { id: 'p1', price: 100, stock: 5, is_available: true, deleted_at: null, name_uz: 'Non' };
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        shop,
        items: [{ product_id: 'p1', quantity: 2, product }],
      });
      prisma.product.findUnique.mockResolvedValue(product);
      const createdOrder = { id: 'order-1', total_amount: 200, shop: { id: shop.id, owner_id: shop.owner_id } };
      prisma.order.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder('customer-1', {
        address_text: 'addr',
        lat: 1,
        lng: 1,
        customer_phone: '+998900000000',
        payment_method: 'cash' as any,
      });

      expect(result).toBe(createdOrder);
      expect(queue.add).toHaveBeenCalledWith(
        'auto-cancel',
        { orderId: 'order-1' },
        expect.objectContaining({ delay: ORDER_ACCEPTANCE_TIMEOUT_MS, jobId: 'order-1' }),
      );
    });

    it('rejects when the shop is not active', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        shop: { ...shop, is_active: false },
        items: [{ product_id: 'p1', quantity: 1, product: { id: 'p1', price: 100 } }],
      });

      await expect(
        service.createOrder('customer-1', {
          address_text: 'addr',
          lat: 1,
          lng: 1,
          customer_phone: '+998900000000',
          payment_method: 'cash' as any,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('transitionOrder (via acceptOrder/rejectOrder/updateStatus)', () => {
    function mockOrder(status: OrderStatus) {
      return {
        id: 'order-1',
        status,
        customer_id: 'customer-1',
        shop_id: 'shop-1',
        shop: { ...shop },
        items: [{ product_id: 'p1', quantity: 1 }],
        payment_method: 'cash',
      };
    }

    it('allows the seller to accept a NEW order and clears the auto-cancel job', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder(OrderStatus.NEW));
      prisma.order.update.mockResolvedValue({ ...mockOrder(OrderStatus.ACCEPTED), items: [] });

      await service.acceptOrder('order-1', 'owner-1');

      expect(queue.remove).toHaveBeenCalledWith('order-1');
      expect(prisma.order.update).toHaveBeenCalled();
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
});
