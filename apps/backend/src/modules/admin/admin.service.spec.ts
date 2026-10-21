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
