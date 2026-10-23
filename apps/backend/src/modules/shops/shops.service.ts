import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_SEARCH_RADIUS_METERS, UserRole, isShopOpenNow } from '@localshop/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';
import { PRODUCTS_DEFAULT_LIMIT, PRODUCTS_MAX_LIMIT, PRODUCTS_UNPAGED_CAP, RegisterShopDto } from './shops.dto';

/** ~111 m grid used for the nearby cache: 3 decimal places of a degree. */
const NEARBY_GRID_SCALE = 1000;

/**
 * Snaps a coordinate to the centre of its ~100 m grid cell so every caller in
 * the same cell runs (and caches) the identical query, instead of the first
 * caller's raw position deciding what everybody else sees for 30 s.
 */
export function gridCellCentre(value: number, scale = NEARBY_GRID_SCALE): number {
  return (Math.floor(value * scale) + 0.5) / scale;
}

const REGISTRATION_CONFLICT = {
  code: 'REGISTRATION_CONFLICT',
  message: 'This login or phone number is already registered.',
};

@Injectable()
export class ShopsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private cache?: CacheService,
  ) {}

  /**
   * Self-service shop registration (spec: POST /store/register). Creates the
   * shopkeeper account and shop as `pending`/inactive so it stays invisible
   * to customers until an admin approves it — mirrors the admin-create flow
   * but lets the owner choose their own login/password up front.
   *
   * Login and phone collisions are both reported as one generic 409 so the
   * public endpoint cannot be used to enumerate which logins/phones exist.
   */
  async registerShop(dto: RegisterShopDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ login: dto.login }, { phone: dto.phone }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(REGISTRATION_CONFLICT);
    }

    let cityId = dto.city_id;
    if (!cityId) {
      const city = await this.prisma.city.findFirst({ where: { is_active: true } });
      cityId = city ? city.id : '00000000-0000-0000-0000-000000000001';
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      return await this.createPendingShop(dto, cityId, passwordHash);
    } catch (e) {
      // Race between the pre-check and the insert: same answer as the pre-check.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(REGISTRATION_CONFLICT);
      }
      throw e;
    }
  }

  private createPendingShop(dto: RegisterShopDto, cityId: string, passwordHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          login: dto.login,
          phone: dto.phone,
          name: dto.owner_name,
          password_hash: passwordHash,
          role: UserRole.SELLER as any,
          must_change_password: false,
          is_blocked: false,
        },
      });

      const shop = await tx.shop.create({
        data: {
          owner_id: owner.id,
          city_id: cityId,
          name: dto.name,
          phone: dto.phone,
          address_text: dto.address_text,
          lat: dto.lat,
          lng: dto.lng,
          open_time: dto.open_time || '08:00',
          close_time: dto.close_time || '22:00',
          is_open: false,
          is_active: false,
          status: 'pending' as any,
          commission_rate_percent: 0,
        },
        include: {
          owner: { select: { id: true, login: true, name: true, phone: true } },
          city: true,
        },
      });

      return shop;
    });
  }

  /**
   * Evaluates if a shop is currently open based on current time and manual switch.
   * Delegates to the shared helper so listing, shop page and order creation agree.
   */
  isShopOpen(openTime: string, closeTime: string, manualIsOpen: boolean): boolean {
    return isShopOpenNow(openTime, closeTime, manualIsOpen);
  }

  /**
   * Search nearby shops within radius (default 3000m) with ~100m grid caching (30s).
   *
   * The query point is the centre of the caller's grid cell, not the raw
   * coordinates: distances are then identical for everyone in the cell, which
   * is what makes the shared cache entry honest (#34). Inputs arrive validated
   * by NearbyQueryDto (lat/lng ranges, radius 100..10000, category <= 64 chars),
   * so the cache key is bounded.
   */
  async findNearby(
    lat: number,
    lng: number,
    radiusMeters: number = DEFAULT_SEARCH_RADIUS_METERS,
    categoryId?: string,
  ) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return [];
    }

    const cellLat = gridCellCentre(lat);
    const cellLng = gridCellCentre(lng);

    if (!this.cache) {
      return this.computeNearby(cellLat, cellLng, radiusMeters, categoryId);
    }

    const cacheKey = `nearby:${cellLat.toFixed(4)}:${cellLng.toFixed(4)}:${radiusMeters}:${categoryId || 'all'}`;

    return this.cache.wrap(
      cacheKey,
      () => this.computeNearby(cellLat, cellLng, radiusMeters, categoryId),
      30, // 30 seconds TTL
    );
  }

  /**
   * Available-product counts for the given shops only (optionally one category).
   * Runs AFTER the radius filter so the aggregate touches the few shops in range,
   * not the whole products table.
   */
  private async productCountsFor(shopIds: string[], categoryId?: string): Promise<Map<string, number>> {
    if (shopIds.length === 0) return new Map();
    const rows = await this.prisma.product.groupBy({
      by: ['shop_id'],
      where: {
        shop_id: { in: shopIds },
        is_available: true,
        deleted_at: null,
        ...(categoryId ? { category_id: categoryId } : {}),
      },
      _count: { _all: true },
    });
    return new Map(rows.map((p) => [p.shop_id, p._count._all]));
  }

  private async computeNearby(
    lat: number,
    lng: number,
    radiusMeters: number = DEFAULT_SEARCH_RADIUS_METERS,
    categoryId?: string,
  ) {
    // Shops with zero matching products are excluded when a category filter is set.
    const withCounts = async <T extends { id: string }>(shops: T[]) => {
      const countByShop = await this.productCountsFor(shops.map((s) => s.id), categoryId);
      return shops
        .filter((shop) => !categoryId || (countByShop.get(shop.id) || 0) > 0)
        .map((shop) => ({ ...shop, productCount: countByShop.get(shop.id) || 0 }));
    };

    let inRange: any[];
    let fromPostgis = true;
    try {
      // Spatial query using PostGIS ST_DWithin. The ST_SetSRID(ST_MakePoint(...))::geography
      // expression must stay exactly as written: it matches shops_geo_gist_idx (0_init).
      // owner_id is deliberately not selected: it is an internal user id, not public data.
      inRange = await this.prisma.$queryRaw`
        SELECT
          s.id, s.city_id, s.name, s.logo_url, s.phone, s.address_text,
          s.lat, s.lng, s.open_time, s.close_time, s.is_open, s.is_active, s.status, s.commission_rate_percent,
          s.created_at, s.updated_at,
          ROUND(ST_Distance(
            ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
          )) AS "distanceMeters"
        FROM shops s
        WHERE s.is_active = true
          AND s.status = 'active'
          AND s.lat IS NOT NULL
          AND s.lng IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY "distanceMeters" ASC;
      `;
    } catch {
      // Fallback with Haversine distance in memory if PostGIS is not enabled (dev database / memory store)
      fromPostgis = false;
      const activeShops = await this.prisma.shop.findMany({
        where: { is_active: true, status: 'active' as any },
      });
      inRange = activeShops
        .map(({ owner_id: _ownerId, ...shop }) => ({
          ...shop,
          distanceMeters: this.prisma.calculateDistanceMeters(lat, lng, shop.lat, shop.lng),
        }))
        .filter((shop) => shop.distanceMeters <= radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    }

    const shops = await withCounts(inRange);
    return shops.map((shop) => ({
      ...shop,
      distanceMeters: fromPostgis ? Number(shop.distanceMeters) : shop.distanceMeters,
      isCurrentlyOpen: this.isShopOpen(shop.open_time, shop.close_time, shop.is_open),
    }));
  }

  /**
   * Shop details. With the customer's point, also returns `distanceMeters`
   * (same Haversine as the nearby fallback) so the shop page can show it
   * without relying on the Home list being loaded first; `productCount` is
   * the number of available products.
   */
  async findOne(id: string, from?: { lat: number; lng: number }) {
    const fetchShop = async () => {
      const s = await this.prisma.shop.findUnique({
        where: { id },
        include: {
          city: true,
        },
      });

      if (!s || !s.is_active || s.status !== ('active' as any)) {
        throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found or inactive' });
      }

      const count = await this.prisma.product.count({
        where: { shop_id: s.id, deleted_at: null, is_available: true },
      });

      return { shop: s, productCount: count };
    };

    const { shop, productCount } = this.cache
      ? await this.cache.wrap(`shop:${id}:profile`, fetchShop, 60)
      : await fetchShop();

    return {
      ...shop,
      productCount,
      distanceMeters: from ? this.prisma.calculateDistanceMeters(from.lat, from.lng, shop.lat, shop.lng) : null,
      isCurrentlyOpen: this.isShopOpen(shop.open_time, shop.close_time, shop.is_open),
    };
  }

  /**
   * Public product list of an active shop.
   *
   * Response shape is opt-in paginated: with neither `page` nor `limit` it stays
   * the bare array the mobile client parses (capped at PRODUCTS_UNPAGED_CAP newest
   * rows); with either present it is `{ data, total, page, limit }`.
   */
  async findShopProducts(
    shopId: string,
    categoryId?: string,
    query?: string,
    pagination?: { page?: number; limit?: number },
  ) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || !shop.is_active || shop.status !== ('active' as any)) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found or inactive' });
    }

    const where: Prisma.ProductWhereInput = {
      shop_id: shopId,
      deleted_at: null,
      is_available: true,
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(query
        ? {
            OR: [
              { name_uz: { contains: query, mode: 'insensitive' } },
              { name_ru: { contains: query, mode: 'insensitive' } },
              { name_en: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const paged = pagination && (pagination.page !== undefined || pagination.limit !== undefined);
    if (!paged) {
      return this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { created_at: 'desc' },
        take: PRODUCTS_UNPAGED_CAP,
      });
    }

    const page = Math.max(1, pagination!.page ?? 1);
    const limit = Math.min(PRODUCTS_MAX_LIMIT, Math.max(1, pagination!.limit ?? PRODUCTS_DEFAULT_LIMIT));
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
