import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DEFAULT_SEARCH_RADIUS_METERS, UserRole } from '@localshop/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';
import { RegisterShopDto } from './shops.dto';

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
   */
  async registerShop(dto: RegisterShopDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { login: dto.login } });
    if (existingUser) {
      throw new ConflictException({
        code: 'SELLER_LOGIN_EXISTS',
        message: `Username '${dto.login}' is already in use. Please choose another.`,
      });
    }

    let cityId = dto.city_id;
    if (!cityId) {
      const city = await this.prisma.city.findFirst({ where: { is_active: true } });
      cityId = city ? city.id : '00000000-0000-0000-0000-000000000001';
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

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
   */
  isShopOpen(openTime: string, closeTime: string, manualIsOpen: boolean): boolean {
    if (!manualIsOpen) {
      return false;
    }

    // Current local time in Uzbekistan (UTC+5)
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const uzHours = (utcHours + 5) % 24;
    const currentMinutes = uzHours * 60 + utcMinutes;

    const [openH, openM] = (openTime || '08:00').split(':').map(Number);
    const [closeH, closeM] = (closeTime || '22:00').split(':').map(Number);
    const openTotal = openH * 60 + openM;
    const closeTotal = closeH * 60 + closeM;

    if (closeTotal > openTotal) {
      return currentMinutes >= openTotal && currentMinutes <= closeTotal;
    } else {
      // Handles overnight hours (e.g. 20:00 to 02:00)
      return currentMinutes >= openTotal || currentMinutes <= closeTotal;
    }
  }

  /**
   * Search nearby shops within radius (default 3000m) with ~100m geohash grid caching (30s)
   */
  async findNearby(
    lat: number,
    lng: number,
    radiusMeters: number = DEFAULT_SEARCH_RADIUS_METERS,
    categoryId?: string,
  ) {
    if (!lat || !lng) {
      return [];
    }

    if (!this.cache) {
      return this.computeNearby(lat, lng, radiusMeters, categoryId);
    }

    // ~100m grid cell caching: 3 decimal places is ~111m precision
    const gridLat = Number(lat).toFixed(3);
    const gridLng = Number(lng).toFixed(3);
    const cacheKey = `nearby:${gridLat}:${gridLng}:${radiusMeters}:${categoryId || 'all'}`;

    return this.cache.wrap(
      cacheKey,
      () => this.computeNearby(lat, lng, radiusMeters, categoryId),
      30, // 30 seconds TTL
    );
  }

  private async computeNearby(
    lat: number,
    lng: number,
    radiusMeters: number = DEFAULT_SEARCH_RADIUS_METERS,
    categoryId?: string,
  ) {
    // Count available products per shop (optionally restricted to a category).
    // Shops with zero matching products are excluded when a category filter is set.
    const productCounts = await this.prisma.product.groupBy({
      by: ['shop_id'],
      where: {
        is_available: true,
        deleted_at: null,
        ...(categoryId ? { category_id: categoryId } : {}),
      },
      _count: { _all: true },
    });
    const countByShop = new Map<string, number>(productCounts.map((p) => [p.shop_id, p._count._all]));
    const withCounts = <T extends { id: string }>(shops: T[]) =>
      shops
        .filter((shop) => !categoryId || (countByShop.get(shop.id) || 0) > 0)
        .map((shop) => ({ ...shop, productCount: countByShop.get(shop.id) || 0 }));

    try {
      // Attempt spatial query using PostGIS ST_DWithin
      const rawShops: any[] = await this.prisma.$queryRaw`
        SELECT
          s.id, s.owner_id, s.city_id, s.name, s.logo_url, s.phone, s.address_text,
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

      return withCounts(rawShops).map((shop) => ({
        ...shop,
        distanceMeters: Number(shop.distanceMeters),
        isCurrentlyOpen: this.isShopOpen(shop.open_time, shop.close_time, shop.is_open),
      }));
    } catch {
      // Fallback query with Haversine distance in memory if PostGIS is not enabled in dev database
      const activeShops = await this.prisma.shop.findMany({
        where: { is_active: true, status: 'active' as any },
      });

      return withCounts(activeShops)
        .map((shop) => {
          const distance = this.prisma.calculateDistanceMeters(lat, lng, shop.lat, shop.lng);
          return {
            ...shop,
            distanceMeters: distance,
            isCurrentlyOpen: this.isShopOpen(shop.open_time, shop.close_time, shop.is_open),
          };
        })
        .filter((shop) => shop.distanceMeters <= radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
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

  async findShopProducts(shopId: string, categoryId?: string, query?: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || !shop.is_active || shop.status !== ('active' as any)) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found or inactive' });
    }

    return this.prisma.product.findMany({
      where: {
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
      },
      include: {
        category: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
