import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Room-join authorization for the realtime gateway.
 *
 * Shop rooms carry full order payloads (customer phone, address, items), so
 * only the shop's owner or a platform admin may join them; order rooms are
 * limited to the order's customer, the shop owner and admins. Anonymous or
 * foreign sockets must be refused and must not be added to the room.
 */
describe('NotificationsGateway room authorization', () => {
  const SHOP_ID = 'shop-1';
  const OWNER_ID = 'seller-1';
  const ORDER_ID = 'order-1';
  const CUSTOMER_ID = 'customer-1';

  let gateway: NotificationsGateway;
  let prisma: { shop: { findUnique: jest.Mock }; order: { findUnique: jest.Mock } };

  const makeClient = (user: { sub: string; role: string } | null) => ({
    id: 'sock-1',
    data: user ? { user } : {},
    join: jest.fn(),
  });

  beforeEach(() => {
    prisma = {
      shop: { findUnique: jest.fn() },
      order: { findUnique: jest.fn() },
    };
    prisma.shop.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === SHOP_ID ? { id: SHOP_ID, owner_id: OWNER_ID } : null,
    );
    prisma.order.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === ORDER_ID
        ? { id: ORDER_ID, customer_id: CUSTOMER_ID, shop: { owner_id: OWNER_ID } }
        : null,
    );

    gateway = new NotificationsGateway(
      new JwtService({ secret: 'test-secret' }),
      new ConfigService({}),
      prisma as unknown as PrismaService,
    );
  });

  describe('join:shop', () => {
    it('lets the shop owner join the shop room', async () => {
      const client = makeClient({ sub: OWNER_ID, role: 'seller' });
      const res = await gateway.handleJoinShop(client as any, SHOP_ID);
      expect(client.join).toHaveBeenCalledWith(`shop:${SHOP_ID}`);
      expect(res).toEqual({ event: 'joined', room: `shop:${SHOP_ID}` });
    });

    it('lets an admin join any shop room', async () => {
      const client = makeClient({ sub: 'admin-1', role: 'admin' });
      await gateway.handleJoinShop(client as any, SHOP_ID);
      expect(client.join).toHaveBeenCalledWith(`shop:${SHOP_ID}`);
    });

    it('refuses an anonymous (unauthenticated) socket', async () => {
      const client = makeClient(null);
      const res = await gateway.handleJoinShop(client as any, SHOP_ID);
      expect(client.join).not.toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ event: 'error', code: 'UNAUTHORIZED' }));
    });

    it('refuses a seller who does not own the shop', async () => {
      const client = makeClient({ sub: 'seller-other', role: 'seller' });
      const res = await gateway.handleJoinShop(client as any, SHOP_ID);
      expect(client.join).not.toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ event: 'error', code: 'FORBIDDEN' }));
    });

    it('refuses a customer', async () => {
      const client = makeClient({ sub: CUSTOMER_ID, role: 'customer' });
      const res = await gateway.handleJoinShop(client as any, SHOP_ID);
      expect(client.join).not.toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ event: 'error', code: 'FORBIDDEN' }));
    });

    it('refuses an unknown shop id without throwing', async () => {
      const client = makeClient({ sub: OWNER_ID, role: 'seller' });
      const res = await gateway.handleJoinShop(client as any, 'nope');
      expect(client.join).not.toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ event: 'error', code: 'FORBIDDEN' }));
    });

    it('refuses a malformed payload', async () => {
      const client = makeClient({ sub: OWNER_ID, role: 'seller' });
      const res = await gateway.handleJoinShop(client as any, { id: SHOP_ID } as any);
      expect(client.join).not.toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ event: 'error', code: 'BAD_REQUEST' }));
      expect(prisma.shop.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('join:order', () => {
    it("lets the order's customer join", async () => {
      const client = makeClient({ sub: CUSTOMER_ID, role: 'customer' });
      await gateway.handleJoinOrder(client as any, ORDER_ID);
      expect(client.join).toHaveBeenCalledWith(`order:${ORDER_ID}`);
    });

    it("lets the order's shop owner join", async () => {
      const client = makeClient({ sub: OWNER_ID, role: 'seller' });
      await gateway.handleJoinOrder(client as any, ORDER_ID);
      expect(client.join).toHaveBeenCalledWith(`order:${ORDER_ID}`);
    });

    it('lets an admin join', async () => {
      const client = makeClient({ sub: 'admin-1', role: 'admin' });
      await gateway.handleJoinOrder(client as any, ORDER_ID);
      expect(client.join).toHaveBeenCalledWith(`order:${ORDER_ID}`);
    });

    it('refuses another customer', async () => {
      const client = makeClient({ sub: 'customer-other', role: 'customer' });
      const res = await gateway.handleJoinOrder(client as any, ORDER_ID);
      expect(client.join).not.toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ event: 'error', code: 'FORBIDDEN' }));
    });

    it('refuses an anonymous socket', async () => {
      const client = makeClient(null);
      const res = await gateway.handleJoinOrder(client as any, ORDER_ID);
      expect(client.join).not.toHaveBeenCalled();
      expect(res).toEqual(expect.objectContaining({ event: 'error', code: 'UNAUTHORIZED' }));
    });
  });
});
