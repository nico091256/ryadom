import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, UpdateShopProfileDto } from './seller.dto';
import { OrderStatus } from '@localshop/shared';

@Injectable()
export class SellerService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.shop.update({
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
  }

  async getProducts(ownerId: string) {
    const shop = await this.getSellerShop(ownerId);

    return this.prisma.product.findMany({
      where: {
        shop_id: shop.id,
        deleted_at: null,
      },
      include: { category: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async createProduct(ownerId: string, dto: CreateProductDto) {
    const shop = await this.getSellerShop(ownerId);

    // Multilingual fallback: If a name is filled in only one language, fall back to it
    const primaryName = dto.name_uz || dto.name_ru || dto.name_en || 'Product';
    const nameUz = dto.name_uz || primaryName;
    const nameRu = dto.name_ru || primaryName;
    const nameEn = dto.name_en || primaryName;

    return this.prisma.product.create({
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

    return this.prisma.product.update({
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

    const [todayOrders, weekOrders, monthOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          shop_id: shop.id,
          created_at: { gte: startOfToday },
          status: { not: OrderStatus.CANCELLED as any },
        },
        select: { total_amount: true },
      }),
      this.prisma.order.findMany({
        where: {
          shop_id: shop.id,
          created_at: { gte: startOfWeek },
          status: { not: OrderStatus.CANCELLED as any },
        },
        select: { total_amount: true },
      }),
      this.prisma.order.findMany({
        where: {
          shop_id: shop.id,
          created_at: { gte: startOfMonth },
          status: { not: OrderStatus.CANCELLED as any },
        },
        select: { total_amount: true },
      }),
    ]);

    return {
      today: {
        orderCount: todayOrders.length,
        revenueTiyin: todayOrders.reduce((acc, o) => acc + o.total_amount, 0),
      },
      thisWeek: {
        orderCount: weekOrders.length,
        revenueTiyin: weekOrders.reduce((acc, o) => acc + o.total_amount, 0),
      },
      thisMonth: {
        orderCount: monthOrders.length,
        revenueTiyin: monthOrders.reduce((acc, o) => acc + o.total_amount, 0),
      },
    };
  }
}
