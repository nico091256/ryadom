import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@localshop/shared';
import { PosService } from './pos.service';

const shop = { id: 'shop-1', owner_id: 'owner-1' };

describe('PosService.syncProducts', () => {
  let prisma: any;
  let service: PosService;

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p-barcode', barcode: '4780000000012', sku: null },
          { id: 'p-sku', barcode: null, sku: 'MLK-1L' },
          { id: 'p-both', barcode: '111', sku: 'BOTH' },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      order: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    service = new PosService(prisma, {} as any);
  });

  it('matches by barcode, then by sku, updates only the sent fields and reports unknown codes', async () => {
    const result = await service.syncProducts(shop, [
      { barcode: '4780000000012', price: 1500000 },
      { sku: 'MLK-1L', stock: 7, is_available: false },
      { barcode: '111', sku: 'IGNORED-WHEN-BARCODE-MATCHES', stock: 1 },
      { barcode: '999', stock: 3 },
      { sku: 'MLK-1L' },
      { price: 100 },
    ]);

    expect(result.updated).toBe(3);
    expect(result.not_found).toEqual([{ barcode: '999' }]);
    expect(result.skipped).toEqual([
      { sku: 'MLK-1L', reason: 'nothing to update (send price, stock or is_available)' },
      { reason: 'barcode or sku is required' },
    ]);

    expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p-barcode' }, data: { price: 1500000 } });
    expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p-sku' }, data: { stock: 7, is_available: false } });
    expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'p-both' }, data: { stock: 1 } });
    expect(prisma.product.update).toHaveBeenCalledTimes(3);
  });

  it('scopes the lookup to the shop and excludes soft-deleted products', async () => {
    await service.syncProducts(shop, [{ barcode: '4780000000012', stock: 1 }]);
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { shop_id: 'shop-1', deleted_at: null, OR: [{ barcode: { in: ['4780000000012'] } }] },
      select: { id: true, barcode: true, sku: true },
    });
  });
});

describe('PosService.updateOrderStatus', () => {
  let prisma: any;
  let orders: any;
  let service: PosService;

  beforeEach(() => {
    prisma = { order: { findUnique: jest.fn().mockResolvedValue({ id: 'o-1', shop_id: 'shop-1' }) }, product: {} };
    orders = {
      acceptOrder: jest.fn().mockResolvedValue({ id: 'o-1', status: 'accepted' }),
      cancelOrder: jest.fn().mockResolvedValue({ id: 'o-1', status: 'cancelled' }),
      updateStatus: jest.fn().mockResolvedValue({ id: 'o-1', status: 'on_the_way' }),
    };
    service = new PosService(prisma, orders);
  });

  it('rejects orders that belong to another shop', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o-1', shop_id: 'other-shop' });
    await expect(service.updateOrderStatus(shop, 'o-1', { status: 'accepted' })).rejects.toBeInstanceOf(NotFoundException);
    expect(orders.acceptOrder).not.toHaveBeenCalled();
  });

  it('routes each status through the seller lifecycle, attributed to the shop owner', async () => {
    await service.updateOrderStatus(shop, 'o-1', { status: 'accepted' });
    expect(orders.acceptOrder).toHaveBeenCalledWith('o-1', 'owner-1');

    await service.updateOrderStatus(shop, 'o-1', { status: 'cancelled', reason: 'Mahsulot tugagan' });
    expect(orders.cancelOrder).toHaveBeenCalledWith('o-1', 'owner-1', UserRole.SELLER, { reason: 'Mahsulot tugagan' });

    await service.updateOrderStatus(shop, 'o-1', { status: 'on_the_way' });
    expect(orders.updateStatus).toHaveBeenCalledWith('o-1', 'owner-1', { status: 'on_the_way' });
  });
});
