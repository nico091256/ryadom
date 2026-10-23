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
