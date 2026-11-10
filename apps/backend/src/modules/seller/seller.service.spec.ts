import { OrderStatus } from '@localshop/shared';
import { SellerService } from './seller.service';

describe('SellerService.getStats', () => {
  let prisma: any;
  let service: SellerService;

  beforeEach(() => {
    prisma = {
      shop: { findFirst: jest.fn().mockResolvedValue({ id: 'shop-1', owner_id: 'owner-1' }) },
      order: { groupBy: jest.fn() },
    };
    service = new SellerService(prisma);
  });

  it('counts non-cancelled orders but only books delivered orders as revenue', async () => {
    prisma.order.groupBy.mockResolvedValue([
      { status: OrderStatus.NEW, _count: { _all: 2 }, _sum: { total_amount: 300000 } },
      { status: OrderStatus.ACCEPTED, _count: { _all: 1 }, _sum: { total_amount: 100000 } },
      { status: OrderStatus.DELIVERED, _count: { _all: 4 }, _sum: { total_amount: 1600000 } },
      { status: OrderStatus.CANCELLED, _count: { _all: 3 }, _sum: { total_amount: 999999 } },
    ]);

    const stats = await service.getStats('owner-1');

    expect(stats.today).toEqual({ orderCount: 7, revenueTiyin: 1600000 });
    expect(stats.thisWeek).toEqual({ orderCount: 7, revenueTiyin: 1600000 });
    expect(stats.thisMonth).toEqual({ orderCount: 7, revenueTiyin: 1600000 });
  });

  it('issues one grouped aggregate per window scoped to the shop, no row-level reads', async () => {
    prisma.order.groupBy.mockResolvedValue([]);

    const stats = await service.getStats('owner-1');

    expect(stats.today).toEqual({ orderCount: 0, revenueTiyin: 0 });
    expect(prisma.order.groupBy).toHaveBeenCalledTimes(3);
    for (const [args] of prisma.order.groupBy.mock.calls) {
      expect(args).toEqual({
        by: ['status'],
        where: { shop_id: 'shop-1', created_at: { gte: expect.any(Date) } },
        _count: { _all: true },
        _sum: { total_amount: true },
      });
    }
    // Windows are ordered today >= week start >= month start.
    const [today, week, month] = prisma.order.groupBy.mock.calls.map(([a]: any[]) => a.where.created_at.gte.getTime());
    expect(today).toBeGreaterThanOrEqual(week);
    expect(today).toBeGreaterThanOrEqual(month);
  });

  it('treats a null delivered sum as zero', async () => {
    prisma.order.groupBy.mockResolvedValue([{ status: OrderStatus.DELIVERED, _count: { _all: 0 }, _sum: { total_amount: null } }]);
    const stats = await service.getStats('owner-1');
    expect(stats.today.revenueTiyin).toBe(0);
  });
});

describe('SellerService.getProducts — opt-in pagination (#33)', () => {
  let prisma: any;
  let service: SellerService;

  beforeEach(() => {
    prisma = {
      shop: { findFirst: jest.fn().mockResolvedValue({ id: 'shop-1', owner_id: 'owner-1' }) },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }]), count: jest.fn().mockResolvedValue(130) },
    };
    service = new SellerService(prisma);
  });

  it('returns a bare array capped at 1000 when no pagination is requested (store panel shape)', async () => {
    const result = await service.getProducts('owner-1', {});
    expect(result).toEqual([{ id: 'p1' }]);
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { shop_id: 'shop-1', deleted_at: null },
      include: { category: true },
      orderBy: { created_at: 'desc' },
      take: 1000,
    });
    expect(prisma.product.count).not.toHaveBeenCalled();
  });

  it('returns the envelope when limit is given, defaulting page to 1', async () => {
    const result = await service.getProducts('owner-1', { limit: 20 });
    expect(result).toEqual({ data: [{ id: 'p1' }], total: 130, page: 1, limit: 20 });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
  });

  it('clamps limit to 100 and offsets by page', async () => {
    const result: any = await service.getProducts('owner-1', { page: 3, limit: 999 });
    expect(result).toMatchObject({ page: 3, limit: 100 });
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 200, take: 100 }));
  });
});

describe('SellerService.bulkImportPosItems — 1000 items with images batching', () => {
  it('batches 1000 items with image_path / images[] via createMany in chunks of 250', async () => {
    const prisma: any = {
      shop: { findFirst: jest.fn().mockResolvedValue({ id: 'shop-1', owner_id: 'owner-1', pos_type: 'regos' }) },
      category: { findMany: jest.fn().mockResolvedValue([{ id: 'cat-1', name_uz: 'Oziq-ovqat' }]) },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 250 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new SellerService(prisma);

    const items = Array.from({ length: 1000 }, (_, i) => ({
      code: i + 1,
      barcode: `478000${String(i + 1).padStart(7, '0')}`,
      name: `Mahsulot #${i + 1}`,
      price: 12000,
      quantity: 15,
      image_path: `https://cdn.regos.uz/items/img-${i + 1}.webp`,
    }));

    const res = await service.bulkImportPosItems('owner-1', { items, price_in_som: true });

    expect(res).toEqual({
      source: 'file_import',
      created: 1000,
      updated: 0,
      skipped: 0,
      total: 1000,
    });
    // 1000 items / 250 per batch = 4 createMany queries instead of 1000 individual INSERTs!
    expect(prisma.product.createMany).toHaveBeenCalledTimes(4);
    expect(prisma.product.createMany.mock.calls[0][0].data[0].image_url).toBe(
      'https://cdn.regos.uz/items/img-1.webp',
    );
  });

  it('syncs demo catalog for YES POS (pos_type=yespos) and updates shop pos_type', async () => {
    const prisma: any = {
      shop: {
        findFirst: jest.fn().mockResolvedValue({ id: 'shop-1', owner_id: 'owner-1', pos_type: 'regos' }),
        update: jest.fn().mockResolvedValue({}),
      },
      category: { findMany: jest.fn().mockResolvedValue([{ id: 'cat-1', name_uz: 'Non va pishiriqlar' }]) },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 8 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new SellerService(prisma);

    const res = await service.syncFromRegos('owner-1', {
      pos_type: 'yespos',
      integration_key: 'demo',
    });

    expect(res.source).toBe('yespos_demo');
    expect(res.created).toBeGreaterThan(0);
    expect(prisma.shop.update).toHaveBeenCalledWith({
      where: { id: 'shop-1' },
      data: { pos_type: 'yespos' },
    });
  });
});
