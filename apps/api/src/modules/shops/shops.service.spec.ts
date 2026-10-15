import { ConflictException } from '@nestjs/common';
import { ShopsService } from './shops.service';

describe('ShopsService', () => {
  let prisma: any;
  let service: ShopsService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      city: { findFirst: jest.fn() },
      shop: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    service = new ShopsService(prisma);
  });

  describe('registerShop', () => {
    const dto = {
      name: 'New Shop',
      owner_name: 'Owner',
      phone: '+998900000000',
      login: 'new_seller',
      password: 'StrongPass123!',
      address_text: 'addr',
      lat: 41.3,
      lng: 69.24,
    };

    it('rejects a duplicate login', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.registerShop(dto as any)).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates the shop as pending/inactive and the owner without a forced password change', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.city.findFirst.mockResolvedValue({ id: 'city-1' });
      prisma.user.create = jest.fn().mockResolvedValue({ id: 'owner-1' });
      prisma.shop.create = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'shop-1', ...data }));

      const shop = await service.registerShop(dto as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ must_change_password: false, role: 'seller' }) }),
      );
      expect(shop).toMatchObject({ status: 'pending', is_active: false, is_open: false, owner_id: 'owner-1' });
    });
  });

  describe('findOne / findShopProducts — status gating', () => {
    it('treats a pending shop as not found (not yet approved)', async () => {
      prisma.shop.findUnique.mockResolvedValue({ id: 's1', is_active: false, status: 'pending' });
      await expect(service.findOne('s1')).rejects.toThrow();
    });

    it('treats a blocked shop as not found even if is_active were somehow true', async () => {
      prisma.shop.findUnique.mockResolvedValue({ id: 's1', is_active: true, status: 'blocked' });
      await expect(service.findOne('s1')).rejects.toThrow();
    });

    it('returns an active shop normally', async () => {
      prisma.shop.findUnique.mockResolvedValue({
        id: 's1',
        is_active: true,
        status: 'active',
        open_time: '00:00',
        close_time: '23:59',
        is_open: true,
      });
      const result = await service.findOne('s1');
      expect(result.id).toBe('s1');
      expect(result.isCurrentlyOpen).toBe(true);
    });
  });
});
