import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';
import {
  CreateProductDto,
  SELLER_PRODUCTS_DEFAULT_LIMIT,
  SELLER_PRODUCTS_MAX_LIMIT,
  SELLER_PRODUCTS_UNPAGED_CAP,
  UpdateProductDto,
  UpdateShopProfileDto,
} from './seller.dto';
import { OrderStatus } from '@localshop/shared';

@Injectable()
export class SellerService {
  constructor(
    private prisma: PrismaService,
    @Optional() private cache?: CacheService,
  ) {}

  private async invalidateShopCache(shopId: string) {
    if (!this.cache) return;
    await Promise.all([
      this.cache.del(`shop:${shopId}:profile`),
      this.cache.delPattern('nearby:*'),
    ]);
  }

  /**
   * Helper to retrieve seller's shop with ownership verification
   */
  async getSellerShop(ownerId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { owner_id: ownerId },
      include: { city: true },
    });

    if (!shop) {
      throw new NotFoundException({
        code: 'SHOP_NOT_FOUND',
        message: 'No shop is registered under this seller account. Contact admin.',
      });
    }

    return shop;
  }

  async updateShopProfile(ownerId: string, dto: UpdateShopProfileDto) {
    const shop = await this.getSellerShop(ownerId);

    const updated = await this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.logo_url !== undefined ? { logo_url: dto.logo_url } : {}),
        ...(dto.address_text !== undefined ? { address_text: dto.address_text } : {}),
        ...(dto.open_time !== undefined ? { open_time: dto.open_time } : {}),
        ...(dto.close_time !== undefined ? { close_time: dto.close_time } : {}),
        ...(dto.is_open !== undefined ? { is_open: dto.is_open } : {}),
      },
      include: { city: true },
    });

    await this.invalidateShopCache(shop.id);
    return updated;
  }

  /**
   * Seller's own catalogue (incl. unavailable, excl. soft-deleted). Without
   * `page`/`limit` it stays the bare array the store panel parses (capped at
   * SELLER_PRODUCTS_UNPAGED_CAP); with either present it is `{ data, total, page, limit }`.
   */
  async getProducts(ownerId: string, pagination?: { page?: number; limit?: number }) {
    const shop = await this.getSellerShop(ownerId);
    const where = { shop_id: shop.id, deleted_at: null };

    const paged = pagination && (pagination.page !== undefined || pagination.limit !== undefined);
    if (!paged) {
      return this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { created_at: 'desc' },
        take: SELLER_PRODUCTS_UNPAGED_CAP,
      });
    }

    const page = Math.max(1, pagination!.page ?? 1);
    const limit = Math.min(SELLER_PRODUCTS_MAX_LIMIT, Math.max(1, pagination!.limit ?? SELLER_PRODUCTS_DEFAULT_LIMIT));
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

  async createProduct(ownerId: string, dto: CreateProductDto) {
    const shop = await this.getSellerShop(ownerId);

    // Multilingual fallback: If a name is filled in only one language, fall back to it
    const primaryName = dto.name_uz || dto.name_ru || dto.name_en || 'Product';
    const nameUz = dto.name_uz || primaryName;
    const nameRu = dto.name_ru || primaryName;
    const nameEn = dto.name_en || primaryName;

    const created = await this.prisma.product.create({
      data: {
        shop_id: shop.id,
        category_id: dto.category_id,
        name_uz: nameUz,
        name_ru: nameRu,
        name_en: nameEn,
        description_uz: dto.description_uz || null,
        description_ru: dto.description_ru || dto.description_uz || null,
        description_en: dto.description_en || dto.description_uz || null,
        price: dto.price,
        image_url: dto.image_url || null,
        stock: dto.stock,
        is_available: dto.is_available !== undefined ? dto.is_available : true,
      },
      include: { category: true },
    });

    await this.invalidateShopCache(shop.id);
    return created;
  }

  async updateProduct(ownerId: string, productId: string, dto: UpdateProductDto) {
    const shop = await this.getSellerShop(ownerId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.deleted_at) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
    }

    if (product.shop_id !== shop.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot edit product belonging to another shop' });
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name_uz !== undefined ? { name_uz: dto.name_uz } : {}),
        ...(dto.name_ru !== undefined ? { name_ru: dto.name_ru } : {}),
        ...(dto.name_en !== undefined ? { name_en: dto.name_en } : {}),
        ...(dto.category_id !== undefined ? { category_id: dto.category_id } : {}),
        ...(dto.description_uz !== undefined ? { description_uz: dto.description_uz } : {}),
        ...(dto.description_ru !== undefined ? { description_ru: dto.description_ru } : {}),
        ...(dto.description_en !== undefined ? { description_en: dto.description_en } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.image_url !== undefined ? { image_url: dto.image_url || null } : {}),
        ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
        ...(dto.is_available !== undefined ? { is_available: dto.is_available } : {}),
      },
      include: { category: true },
    });

    await this.invalidateShopCache(shop.id);
    return updated;
  }

  async deleteProduct(ownerId: string, productId: string) {
    const shop = await this.getSellerShop(ownerId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
    }

    if (product.shop_id !== shop.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Cannot delete product belonging to another shop' });
    }

    // Soft delete via deleted_at (Section 5)
    await this.prisma.product.update({
      where: { id: productId },
      data: { deleted_at: new Date() },
    });

    await this.invalidateShopCache(shop.id);
    return { success: true, message: 'Product soft deleted successfully' };
  }

  /**
   * Seller stats: orders count and revenue for today, this week, this month (Section 5)
   */
  async getStats(ownerId: string) {
    const shop = await this.getSellerShop(ownerId);

    const now = new Date();
    // Start of today (00:00)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of this week (Monday 00:00) — computed without mutating `now`
    const day = now.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);

    // Start of this month (1st)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // One aggregate per window, grouped by status, so the DB does the summing:
    //  - orderCount  = orders created in the window that were not cancelled (what the
    //    store panel labels "ta buyurtma");
    //  - revenueTiyin = delivered orders only — money actually collected, matching the
    //    admin panel's revenue definition (an accepted-but-not-delivered order is not revenue).
    const [today, thisWeek, thisMonth] = await Promise.all(
      [startOfToday, startOfWeek, startOfMonth].map((since) => this.windowStats(shop.id, since)),
    );

    return { today, thisWeek, thisMonth };
  }

  private async windowStats(shopId: string, since: Date) {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where: { shop_id: shopId, created_at: { gte: since } },
      _count: { _all: true },
      _sum: { total_amount: true },
    });

    let orderCount = 0;
    let revenueTiyin = 0;
    for (const row of rows) {
      if (row.status === (OrderStatus.CANCELLED as any)) continue;
      orderCount += row._count._all;
      if (row.status === (OrderStatus.DELIVERED as any)) {
        revenueTiyin += row._sum.total_amount ?? 0;
      }
    }
    return { orderCount, revenueTiyin };
  }
}
