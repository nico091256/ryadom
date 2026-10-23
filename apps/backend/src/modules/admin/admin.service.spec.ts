import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService — audit trail', () => {
  let prisma: any;
  let orders: any;
  let shops: any;
  let categories: any;
  let audit: any;
  let service: AdminService;

  const actor = { id: 'admin-1', ip: '127.0.0.1' };
  const shop = { id: 's-1', name: 'Shop', status: 'pending', is_active: false, is_open: false };

  beforeEach(() => {
    prisma = {
      shop: {
        findUnique: jest.fn().mockResolvedValue(shop),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...shop, ...data })),
      },
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    orders = { adminCancelOrder: jest.fn().mockResolvedValue(undefined) };
    shops = { isShopOpen: jest.fn().mockReturnValue(true) };
    categories = { create: jest.fn(), update: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AdminService(prisma, orders, shops, categories, audit);
  });

  it('approveShop activates the shop and writes a shop.approve audit entry with the status diff', async () => {
    const result = await service.approveShop('s-1', actor);

    expect(prisma.shop.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's-1' }, data: { status: 'active', is_active: true, is_open: true } }),
    );
    expect(result.status).toBe('active');
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith('admin-1', 'shop.approve', {
      targetType: 'shop',
      targetId: 's-1',
      meta: { from: 'pending', to: 'active' },
      ip: '127.0.0.1',
    });
  });

  it('blockShop / unblockShop record their own actions', async () => {
    await service.blockShop('s-1', actor);
    await service.unblockShop('s-1', actor);

    expect(audit.log.mock.calls.map((c: any[]) => c[1])).toEqual(['shop.block', 'shop.unblock']);
  });

  it('does not write an audit entry when the shop is missing', async () => {
    prisma.shop.findUnique.mockResolvedValue(null);
    await expect(service.approveShop('nope', actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('toggleBlockUser records user.block / user.unblock with the role but no credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'customer' });
    prisma.user.update.mockResolvedValue({ id: 'u-1', is_blocked: true });

    await service.toggleBlockUser('u-1', true, actor);

    expect(audit.log).toHaveBeenCalledWith('admin-1', 'user.block', {
      targetType: 'user',
      targetId: 'u-1',
      meta: { role: 'customer' },
      ip: '127.0.0.1',
    });
  });

  it('toggleBlockUser(true) revokes every refresh token of the user; unblocking does not', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'customer' });
    prisma.user.update.mockResolvedValue({ id: 'u-1', is_blocked: true });

    await service.toggleBlockUser('u-1', true, actor);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'u-1', revoked_at: null },
      data: { revoked_at: expect.any(Date) },
    });

    prisma.refreshToken.updateMany.mockClear();
    await service.toggleBlockUser('u-1', false, actor);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('resetShopPassword sets a temporary password, forces a change and revokes all owner sessions', async () => {
    prisma.shop.findUnique.mockResolvedValue({ ...shop, owner: { id: 'owner-1', login: 'seller_1' } });
    prisma.user.update.mockResolvedValue({ id: 'owner-1' });

    const result = await service.resetShopPassword('s-1', actor);

    expect(result.login).toBe('seller_1');
    expect(typeof result.tempPassword).toBe('string');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      data: { password_hash: expect.any(String), must_change_password: true },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'owner-1', revoked_at: null },
      data: { revoked_at: expect.any(Date) },
    });
    // The temporary password itself never reaches the audit log.
    expect(JSON.stringify(audit.log.mock.calls[0])).not.toContain(result.tempPassword);
  });

  it('cancelOrder records the reason', async () => {
    jest.spyOn(service, 'getOrder').mockResolvedValue({ id: 'o-1' } as any);

    await service.cancelOrder('o-1', 'admin-1', 'customer unreachable', '10.0.0.1');

    expect(orders.adminCancelOrder).toHaveBeenCalledWith('o-1', 'admin-1', 'customer unreachable');
    expect(audit.log).toHaveBeenCalledWith('admin-1', 'order.cancel', {
      targetType: 'order',
      targetId: 'o-1',
      meta: { reason: 'customer unreachable' },
      ip: '10.0.0.1',
    });
  });
});

describe('AdminService — cache invalidation (#24)', () => {
  let prisma: any;
  let cache: any;
  let categories: any;
  let service: AdminService;
  const actor = { id: 'admin-1', ip: null };
  const shop = { id: 's-1', name: 'Shop', status: 'active', is_active: true, is_open: true, open_time: '08:00', close_time: '22:00' };

  beforeEach(() => {
    prisma = {
      shop: {
        findUnique: jest.fn().mockResolvedValue(shop),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...shop, ...data })),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p-1', shop_id: 's-1', deleted_at: null, name_uz: 'Non' }),
        update: jest.fn().mockResolvedValue({ id: 'p-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
      cartItem: { deleteMany: jest.fn() },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'c-1', name_uz: 'Non' }) },
      $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };
    cache = { del: jest.fn().mockResolvedValue(undefined), delPattern: jest.fn().mockResolvedValue(undefined), wrap: jest.fn() };
    categories = {
      create: jest.fn().mockResolvedValue({ id: 'c-1', name_uz: 'Non', parent_id: null }),
      update: jest.fn().mockResolvedValue({ id: 'c-1' }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AdminService(prisma, {} as any, { isShopOpen: () => true } as any, categories, audit as any, cache);
  });

  const expectShopInvalidated = () => {
    expect(cache.del).toHaveBeenCalledWith('shop:s-1:profile');
    expect(cache.delPattern).toHaveBeenCalledWith('nearby:*');
  };

  it.each([
    ['approveShop', () => service.approveShop('s-1', actor)],
    ['blockShop', () => service.blockShop('s-1', actor)],
    ['unblockShop', () => service.unblockShop('s-1', actor)],
    ['updateShop', () => service.updateShop('s-1', { name: 'Renamed' }, actor)],
  ])('%s drops the shop profile and nearby caches', async (_name, run) => {
    await run();
    expectShopInvalidated();
  });

  it('updateProduct / deleteProduct invalidate the owning shop', async () => {
    await service.updateProduct('p-1', { is_available: false }, actor);
    expectShopInvalidated();

    cache.del.mockClear();
    cache.delPattern.mockClear();
    prisma.product.update.mockResolvedValue({ id: 'p-1' });
    prisma.$transaction.mockResolvedValue([]);
    await service.deleteProduct('p-1', actor);
    expectShopInvalidated();
  });

  it('category create / update / delete drop categories:all', async () => {
    await service.createCategory({ name_uz: 'Non' }, actor);
    await service.updateCategory('c-1', { name_ru: 'Хлеб' }, actor);
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        product: { deleteMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
        category: { updateMany: jest.fn(), delete: jest.fn() },
      }),
    );
    await service.deleteCategory('c-1', actor);

    expect(cache.del.mock.calls.filter((c: any[]) => c[0] === 'categories:all')).toHaveLength(3);
  });

  it('works without a CacheService (optional dependency)', async () => {
    const audit = { log: jest.fn() };
    const noCache = new AdminService(prisma, {} as any, { isShopOpen: () => true } as any, categories, audit as any);
    await expect(noCache.approveShop('s-1', actor)).resolves.toBeDefined();
  });
});

describe('AdminService — orders search and dashboard (#22)', () => {
  let prisma: any;
  let cache: any;
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      isPostgresConnected: true,
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { count: jest.fn().mockResolvedValue(0) },
      shop: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      product: { count: jest.fn().mockResolvedValue(0) },
      order: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total_amount: null, commission_amount: null }, _count: { _all: 0 } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    cache = { wrap: jest.fn((_k: string, fetcher: () => Promise<any>, _ttl?: number) => fetcher()) };
    service = new AdminService(prisma, {} as any, { isShopOpen: () => true } as any, {} as any, { log: jest.fn() } as any, cache);
  });

  it('getOrders: short search terms skip the uuid prefix match, long hex ones keep it', async () => {
    await service.getOrders({ q: 'Ali' });
    let where = prisma.order.findMany.mock.calls[0][0].where;
    expect(where.OR.some((c: any) => c.id)).toBe(false);
    expect(where.OR).toContainEqual({ customer: { name: { contains: 'Ali', mode: 'insensitive' } } });

    await service.getOrders({ q: 'A1B2C3D4' });
    where = prisma.order.findMany.mock.calls[1][0].where;
    expect(where.OR[0]).toEqual({ id: { startsWith: 'a1b2c3d4' } });
  });

  it('getDashboardStats is served through cache.wrap(admin:stats, 30s)', async () => {
    await service.getDashboardStats();
    expect(cache.wrap).toHaveBeenCalledWith('admin:stats', expect.any(Function), 30);
  });

  // Yesterday in Tashkent (UTC+5), always inside the 30-day window.
  const yesterdayKey = new Date(Date.now() + 5 * 3600e3 - 86400e3).toISOString().slice(0, 10);

  it('on Postgres the 30-day series comes from one GROUP BY day query, zero-filled to 30 entries', async () => {
    prisma.$queryRaw.mockResolvedValue([{ day: yesterdayKey, orders: BigInt(3), revenue: BigInt(450000) }]);

    const stats = await service.getDashboardStats();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    // The old per-row scan of 30 days of orders is gone.
    expect(prisma.order.findMany).toHaveBeenCalledTimes(1); // recentOrders only
    expect(prisma.order.findMany.mock.calls[0][0]).toMatchObject({ take: 8 });
    expect(stats.daily).toHaveLength(30);
    const hit = stats.daily.find((d) => d.date === yesterdayKey);
    expect(hit).toEqual({ date: yesterdayKey, orders: 3, revenueTiyin: 450000 });
    expect(stats.daily.filter((d) => d.orders === 0)).toHaveLength(29);
  });

  it('without Postgres (memory store) it buckets rows in JS using UTC+5 days', async () => {
    prisma.isPostgresConnected = false;
    // 00:30 Tashkent time on `yesterdayKey` == 19:30Z of the UTC day before: a UTC bucket would misfile it.
    const createdAt = new Date(`${yesterdayKey}T00:30:00.000+05:00`);
    prisma.order.findMany.mockImplementation(({ take }: any) =>
      Promise.resolve(
        take === undefined // the bucket scan; recentOrders passes take: 8
          ? [
              { created_at: createdAt, total_amount: 100000, status: 'delivered' },
              { created_at: createdAt, total_amount: 999, status: 'cancelled' },
            ]
          : [],
      ),
    );

    const stats = await service.getDashboardStats();

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(stats.daily.find((d) => d.date === yesterdayKey)).toEqual({ date: yesterdayKey, orders: 2, revenueTiyin: 100000 });
  });
});
