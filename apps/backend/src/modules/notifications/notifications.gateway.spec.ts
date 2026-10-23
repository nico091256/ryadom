import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsGateway, parseCorsOrigins, socketCorsOrigin } from './notifications.gateway';
import { PrismaService } from '../../common/prisma/prisma.service';

const TEST_JWT_SECRET = 'unit-test-access-secret-minimum-32-characters-long';

/**
 * Handshake authentication: the token must come from `auth.token` or the
 * Authorization header (never the query string), be HS256-signed, belong to an
 * existing, unblocked user, and the socket is cut when the token expires.
 */
describe('NotificationsGateway handshake authentication', () => {
  let gateway: NotificationsGateway;
  let jwt: JwtService;
  let prisma: { user: { findUnique: jest.Mock } };

  const makeClient = (handshake: { auth?: any; headers?: any; query?: any }) => ({
    id: 'sock-1',
    data: {} as any,
    join: jest.fn(),
    disconnect: jest.fn(),
    handshake: { auth: {}, headers: {}, query: {}, ...handshake },
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jwt = new JwtService({ secret: TEST_JWT_SECRET });
    prisma = { user: { findUnique: jest.fn() } };
    prisma.user.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === 'seller-1'
        ? { id: 'seller-1', role: 'seller', is_blocked: false }
        : where.id === 'blocked-1'
          ? { id: 'blocked-1', role: 'customer', is_blocked: true }
          : null,
    );
    gateway = new NotificationsGateway(
      jwt,
      new ConfigService({ JWT_ACCESS_SECRET: TEST_JWT_SECRET }),
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sign = (sub: string, opts: Record<string, any> = {}) =>
    jwt.sign({ sub, role: 'admin' /* must be ignored: the DB role wins */ }, { expiresIn: '15m', ...opts });

  it('authenticates from handshake.auth.token, stores only { sub, role } from the DB and joins the user room', async () => {
    const client = makeClient({ auth: { token: sign('seller-1') } });

    await gateway.handleConnection(client as any);

    expect(client.data.user).toEqual({ sub: 'seller-1', role: 'seller' });
    expect(client.join).toHaveBeenCalledWith('user:seller-1');
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      select: { id: true, role: true, is_blocked: true },
    });
  });

  it('accepts an Authorization: Bearer header', async () => {
    const client = makeClient({ headers: { authorization: `Bearer ${sign('seller-1')}` } });
    await gateway.handleConnection(client as any);
    expect(client.data.user).toEqual({ sub: 'seller-1', role: 'seller' });
  });

  it('ignores a token passed in the query string (stays anonymous)', async () => {
    const client = makeClient({ query: { token: sign('seller-1') } });

    await gateway.handleConnection(client as any);

    expect(client.data.user).toBeUndefined();
    expect(client.join).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token signed with another algorithm (HS512) - stays anonymous', async () => {
    const client = makeClient({ auth: { token: sign('seller-1', { algorithm: 'HS512' }) } });
    await gateway.handleConnection(client as any);
    expect(client.data.user).toBeUndefined();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects a socket whose user is blocked', async () => {
    const client = makeClient({ auth: { token: sign('blocked-1') } });
    await gateway.handleConnection(client as any);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
    expect(client.data.user).toBeUndefined();
  });

  it('disconnects a socket whose user no longer exists', async () => {
    const client = makeClient({ auth: { token: sign('ghost') } });
    await gateway.handleConnection(client as any);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('cuts the connection when the access token expires, and handleDisconnect clears the timer', async () => {
    const client = makeClient({ auth: { token: sign('seller-1', { expiresIn: '2s' }) } });
    await gateway.handleConnection(client as any);
    expect(client.data.expiryTimer).toBeDefined();

    jest.advanceTimersByTime(1_000);
    expect(client.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1_500);
    expect(client.disconnect).toHaveBeenCalledWith(true);

    // A client that leaves on its own must not keep a pending timer alive.
    const client2 = makeClient({ auth: { token: sign('seller-1') } });
    await gateway.handleConnection(client2 as any);
    gateway.handleDisconnect(client2 as any);
    expect(client2.data.expiryTimer).toBeUndefined();
    jest.advanceTimersByTime(16 * 60 * 1000);
    expect(client2.disconnect).not.toHaveBeenCalled();
  });
});

describe('socket CORS origin', () => {
  const original = process.env.CORS_ORIGINS;
  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = original;
  });

  it('reflects any origin when CORS_ORIGINS is unset (development)', () => {
    delete process.env.CORS_ORIGINS;
    const cb = jest.fn();
    socketCorsOrigin('http://localhost:3001', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('allows only the listed origins otherwise', () => {
    process.env.CORS_ORIGINS = 'https://admin.ryadom.uz, https://store.ryadom.uz';
    expect(parseCorsOrigins(process.env.CORS_ORIGINS)).toEqual(['https://admin.ryadom.uz', 'https://store.ryadom.uz']);

    const cb = jest.fn();
    socketCorsOrigin('https://store.ryadom.uz', cb);
    expect(cb).toHaveBeenLastCalledWith(null, true);
    socketCorsOrigin('https://evil.example', cb);
    expect(cb).toHaveBeenLastCalledWith(null, false);
    socketCorsOrigin(undefined, cb);
    expect(cb).toHaveBeenLastCalledWith(null, false);
  });
});

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
