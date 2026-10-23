import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ShopsService, gridCellCentre } from './shops.service';
import { NearbyQueryDto, ShopProductsQueryDto } from './shops.dto';

describe('ShopsService', () => {
  let prisma: any;
  let service: ShopsService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn() },
      city: { findFirst: jest.fn() },
      shop: { findUnique: jest.fn(), findMany: jest.fn() },
      product: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
      calculateDistanceMeters: jest.fn().mockReturnValue(1234),
      $queryRaw: jest.fn(),
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

    it('rejects a duplicate login OR phone with one generic REGISTRATION_CONFLICT', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'existing' });
      const err = await service.registerShop(dto as any).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toEqual({
        code: 'REGISTRATION_CONFLICT',
        message: 'This login or phone number is already registered.',
      });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ login: 'new_seller' }, { phone: '+998900000000' }] },
        select: { id: true },
      });
    });

    it('turns a P2002 race on insert into the same 409 instead of a 500', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.city.findFirst.mockResolvedValue({ id: 'city-1' });
      prisma.user.create = jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.22.0' }),
      );
      const err = await service.registerShop(dto as any).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().code).toBe('REGISTRATION_CONFLICT');
    });

    it('creates the shop as pending/inactive and the owner without a forced password change', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
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

  describe('findNearby', () => {
    const rawShop = (id: string, dist: number) => ({
      id,
      owner_id: `owner-${id}`,
      name: id,
      lat: 41.3,
      lng: 69.24,
      open_time: '00:00',
      close_time: '23:59',
      is_open: true,
      distanceMeters: dist,
    });

    it('gridCellCentre snaps to the centre of the ~111 m cell', () => {
      expect(gridCellCentre(41.28213)).toBeCloseTo(41.2825, 10);
      expect(gridCellCentre(41.28299)).toBeCloseTo(41.2825, 10);
      expect(gridCellCentre(41.28301)).toBeCloseTo(41.2835, 10);
    });

    it('queries PostGIS from the cell centre and scopes the product count to the shops in range', async () => {
      prisma.$queryRaw.mockResolvedValue([rawShop('s1', 120), rawShop('s2', 900)]);
      prisma.product.groupBy.mockResolvedValue([{ shop_id: 's1', _count: { _all: 3 } }]);

      const result = await service.findNearby(41.28213, 69.21377, 3000);

      // SQL parameters are the snapped centre, not the raw position.
      const sqlValues = prisma.$queryRaw.mock.calls[0].slice(1);
      expect(sqlValues).toContain(gridCellCentre(41.28213));
      expect(sqlValues).toContain(gridCellCentre(69.21377));
      expect(sqlValues).not.toContain(41.28213);

      expect(prisma.product.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shop_id: { in: ['s1', 's2'] }, is_available: true, deleted_at: null },
        }),
      );
      expect(result.map((s) => s.productCount)).toEqual([3, 0]);
      expect(result.map((s) => s.distanceMeters)).toEqual([120, 900]);
    });

    it('does not run the product aggregate at all when no shop is in range', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      expect(await service.findNearby(41.3, 69.24, 500)).toEqual([]);
      expect(prisma.product.groupBy).not.toHaveBeenCalled();
    });

    it('never exposes owner_id (PostGIS path and Haversine fallback)', async () => {
      // The raw SELECT no longer lists s.owner_id, so PostGIS rows never carry it.
      const { owner_id: _omitted, ...postgisRow } = rawShop('s1', 10);
      prisma.$queryRaw.mockResolvedValue([postgisRow]);
      const viaPostgis = await service.findNearby(41.3, 69.24);
      expect(viaPostgis[0]).not.toHaveProperty('owner_id');
      expect(service['computeNearby'].toString()).not.toMatch(/s\.owner_id/);

      prisma.$queryRaw.mockRejectedValue(new Error('no postgis'));
      prisma.shop.findMany.mockResolvedValue([rawShop('s2', 0)]);
      const viaFallback = await service.findNearby(41.3, 69.24);
      expect(viaFallback).toHaveLength(1);
      expect(viaFallback[0]).not.toHaveProperty('owner_id');
      expect(viaFallback[0].distanceMeters).toBe(1234);
    });

    it('with a category filter drops shops that stock nothing in it', async () => {
      prisma.$queryRaw.mockResolvedValue([rawShop('s1', 1), rawShop('s2', 2)]);
      prisma.product.groupBy.mockResolvedValue([{ shop_id: 's2', _count: { _all: 1 } }]);

      const result = await service.findNearby(41.3, 69.24, 3000, 'cat-1');

      expect(prisma.product.groupBy.mock.calls[0][0].where).toMatchObject({ category_id: 'cat-1', shop_id: { in: ['s1', 's2'] } });
      expect(result.map((s) => s.id)).toEqual(['s2']);
    });

    it('caches under a key derived from the cell, radius and category only', async () => {
      const cache = { wrap: jest.fn((_k: string, fetcher: () => Promise<any>, _ttl?: number) => fetcher()) };
      service = new ShopsService(prisma, cache as any);
      prisma.$queryRaw.mockResolvedValue([]);

      await service.findNearby(41.28213, 69.21377, 2500, 'cat-1');
      await service.findNearby(41.28299, 69.21301, 2500, 'cat-1');

      expect(cache.wrap.mock.calls[0][0]).toBe('nearby:41.2825:69.2135:2500:cat-1');
      expect(cache.wrap.mock.calls[1][0]).toBe('nearby:41.2825:69.2135:2500:cat-1');
      expect(cache.wrap.mock.calls[0][2]).toBe(30);
    });
  });

  describe('NearbyQueryDto', () => {
    const parse = (q: Record<string, unknown>) => plainToInstance(NearbyQueryDto, q);

    it('coerces strings to numbers and applies the default radius', async () => {
      const dto = parse({ lat: '41.28', lng: '69.21' });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto).toMatchObject({ lat: 41.28, lng: 69.21, radius: 3000 });
    });

    it.each([
      [{ lat: '91', lng: '0' }, 'lat'],
      [{ lat: '0', lng: '-181' }, 'lng'],
      [{ lat: 'abc', lng: '0' }, 'lat'],
      [{ lat: '0', lng: '0', radius: '50' }, 'radius'],
      [{ lat: '0', lng: '0', radius: '20000' }, 'radius'],
      [{ lat: '0', lng: '0', radius: '1.5' }, 'radius'],
      [{ lat: '0', lng: '0', category: 'x'.repeat(65) }, 'category'],
    ])('rejects %j on %s', async (q, prop) => {
      const errors = await validate(parse(q));
      expect(errors.map((e) => e.property)).toContain(prop);
    });
  });

  describe('findShopProducts — opt-in pagination (#33)', () => {
    beforeEach(() => {
      prisma.shop.findUnique.mockResolvedValue({ id: 's1', is_active: true, status: 'active' });
      prisma.product.findMany.mockResolvedValue([{ id: 'p1' }]);
      prisma.product.count.mockResolvedValue(120);
    });

    it('returns a bare array capped at 500 when neither page nor limit is given', async () => {
      const result = await service.findShopProducts('s1', undefined, undefined, {});
      expect(result).toEqual([{ id: 'p1' }]);
      expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
      expect(prisma.product.findMany.mock.calls[0][0]).not.toHaveProperty('skip');
      expect(prisma.product.count).not.toHaveBeenCalled();
    });

    it('returns the envelope with defaults when only page is given', async () => {
      const result = await service.findShopProducts('s1', 'cat', 'milk', { page: 2 });
      expect(result).toEqual({ data: [{ id: 'p1' }], total: 120, page: 2, limit: 50 });
      expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 50 }));
      expect(prisma.product.count.mock.calls[0][0].where).toMatchObject({ shop_id: 's1', category_id: 'cat' });
    });

    it('clamps limit to 100', async () => {
      const result: any = await service.findShopProducts('s1', undefined, undefined, { limit: 1000 });
      expect(result.limit).toBe(100);
    });

    it('ShopProductsQueryDto validates page/limit as positive ints, limit <= 100', async () => {
      const ok = plainToInstance(ShopProductsQueryDto, { page: '2', limit: '20', q: 'non' });
      expect(await validate(ok)).toHaveLength(0);
      expect(ok).toMatchObject({ page: 2, limit: 20 });

      const bad = await validate(plainToInstance(ShopProductsQueryDto, { page: '0', limit: '101' }));
      expect(bad.map((e) => e.property).sort()).toEqual(['limit', 'page']);
    });
  });

  describe('findOne — status gating', () => {
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
      expect(result.productCount).toBe(5);
      expect(result.distanceMeters).toBeNull();
    });

    it('adds the distance from the customer point when lat/lng are given', async () => {
      prisma.shop.findUnique.mockResolvedValue({
        id: 's1',
        is_active: true,
        status: 'active',
        open_time: '00:00',
        close_time: '23:59',
        is_open: true,
        lat: 41.28,
        lng: 69.21,
      });
      const result = await service.findOne('s1', { lat: 41.3, lng: 69.24 });
      expect(prisma.calculateDistanceMeters).toHaveBeenCalledWith(41.3, 69.24, 41.28, 69.21);
      expect(result.distanceMeters).toBe(1234);
    });
  });
});
