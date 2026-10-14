import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DEFAULT_SEARCH_RADIUS_METERS } from '@localshop/shared';

@Injectable()
export class ShopsService {
  constructor(private prisma: PrismaService) {}

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
   * Search nearby shops within radius (default 3000m)
   */
  async findNearby(lat: number, lng: number, radiusMeters: number = DEFAULT_SEARCH_RADIUS_METERS) {
    if (!lat || !lng) {
      return [];
    }

    try {
      // Attempt spatial query using PostGIS ST_DWithin
      const rawShops: any[] = await this.prisma.$queryRaw`
        SELECT 
          s.id, s.owner_id, s.city_id, s.name, s.logo_url, s.phone, s.address_text,
          s.lat, s.lng, s.open_time, s.close_time, s.is_open, s.is_active, s.commission_rate_percent,
          s.created_at, s.updated_at,
          ROUND(ST_Distance(
            ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
          )) AS "distanceMeters"
        FROM shops s
        WHERE s.is_active = true
          AND s.lat IS NOT NULL 
          AND s.lng IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY "distanceMeters" ASC;
      `;

      return rawShops.map((shop) => ({
        ...shop,
        distanceMeters: Number(shop.distanceMeters),
        isCurrentlyOpen: this.isShopOpen(shop.open_time, shop.close_time, shop.is_open),
      }));
    } catch {
      // Fallback query with Haversine distance in memory if PostGIS is not enabled in dev database
      const activeShops = await this.prisma.shop.findMany({
        where: { is_active: true },
      });

      return activeShops
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

  async findOne(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        city: true,
      },
    });

    if (!shop || !shop.is_active) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found or inactive' });
    }

    return {
      ...shop,
      isCurrentlyOpen: this.isShopOpen(shop.open_time, shop.close_time, shop.is_open),
    };
  }

  async findShopProducts(shopId: string, categoryId?: string, query?: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || !shop.is_active) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found or inactive' });
    }

    return this.prisma.product.findMany({
      where: {
        shop_id: shopId,
        deleted_at: null,
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
