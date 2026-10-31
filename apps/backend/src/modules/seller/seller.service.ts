import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';
import {
  CreateProductDto,
  SELLER_PRODUCTS_DEFAULT_LIMIT,
  SELLER_PRODUCTS_MAX_LIMIT,
  SELLER_PRODUCTS_UNPAGED_CAP,
  UpdatePosSettingsDto,
  UpdateProductDto,
  UpdateShopProfileDto,
} from './seller.dto';
import { OrderStatus } from '@localshop/shared';
import { POS_API_KEY_PREFIX } from '../pos/pos.constants';
import { isSafeWebhookUrl } from '../pos/pos-webhook.service';

/** '' and whitespace become null so an empty form field clears the code instead of storing ''. */
function normalizeCode(value: string | null | undefined): string | null {
  const s = (value ?? '').trim();
  return s ? s : null;
}

/** Prisma unique-constraint violation (products_shop_id_barcode_key). */
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'P2002';
}

function barcodeTaken(): ConflictException {
  return new ConflictException({
    code: 'BARCODE_TAKEN',
    message: 'Another product in this shop already uses this barcode.',
  });
}

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

    // lat/lng xaritadan birga keladi; biri kelib ikkinchisi kelmasa — noto'g'ri so'rov.
    if ((dto.lat === undefined) !== (dto.lng === undefined)) {
      throw new BadRequestException({
        code: 'INVALID_COORDINATES',
        message: 'lat and lng must be provided together',
      });
    }

    const updated = await this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.logo_url !== undefined ? { logo_url: dto.logo_url } : {}),
        ...(dto.banner_url !== undefined ? { banner_url: dto.banner_url } : {}),
        ...(dto.address_text !== undefined ? { address_text: dto.address_text } : {}),
        ...(dto.open_time !== undefined ? { open_time: dto.open_time } : {}),
        ...(dto.close_time !== undefined ? { close_time: dto.close_time } : {}),
        ...(dto.is_open !== undefined ? { is_open: dto.is_open } : {}),
        // Nearby qidiruvi lat/lng dan ST_MakePoint bilan hisoblaydi (alohida geo ustun yo'q).
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
      },
      include: { city: true },
    });

    await this.invalidateShopCache(shop.id);
    return updated;
  }

  // ---------- POS (cash register) integration ----------

  /** Issues a fresh key; any previous key stops authenticating immediately. The key is returned once here. */
  async generatePosApiKey(ownerId: string) {
    const shop = await this.getSellerShop(ownerId);
    const key = `${POS_API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
    await this.prisma.shop.update({ where: { id: shop.id }, data: { pos_api_key: key } });
    return { pos_api_key: key };
  }

  async revokePosApiKey(ownerId: string) {
    const shop = await this.getSellerShop(ownerId);
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: { pos_api_key: null },
      include: { city: true },
    });
  }

  async updatePosSettings(ownerId: string, dto: UpdatePosSettingsDto) {
    const shop = await this.getSellerShop(ownerId);
    const url = dto.pos_webhook_url?.trim() || null;
    // The dispatcher refuses private targets anyway; failing here tells the seller why nothing arrives.
    if (url && !isSafeWebhookUrl(url)) {
      throw new BadRequestException({
        code: 'WEBHOOK_URL_NOT_ALLOWED',
        message: 'pos_webhook_url must be a public http(s) address (no localhost / private networks).',
      });
    }
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: { pos_type: dto.pos_type, pos_webhook_url: url },
      include: { city: true },
    });
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

    let created;
    try {
      created = await this.prisma.product.create({
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
          barcode: normalizeCode(dto.barcode),
          sku: normalizeCode(dto.sku),
          stock: dto.stock,
          is_available: dto.is_available !== undefined ? dto.is_available : true,
        },
        include: { category: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw barcodeTaken();
      throw err;
    }

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

    let updated;
    try {
      updated = await this.prisma.product.update({
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
          ...(dto.barcode !== undefined ? { barcode: normalizeCode(dto.barcode) } : {}),
          ...(dto.sku !== undefined ? { sku: normalizeCode(dto.sku) } : {}),
          ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
          ...(dto.is_available !== undefined ? { is_available: dto.is_available } : {}),
        },
        include: { category: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw barcodeTaken();
      throw err;
    }

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

    // Soft delete via deleted_at (Section 5) and remove from any active customer carts
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { deleted_at: new Date(), is_available: false },
      }),
      this.prisma.cartItem.deleteMany({ where: { product_id: productId } }),
    ]);

    await this.invalidateShopCache(shop.id);
    return { success: true, message: 'Product soft deleted successfully' };
  }

  /**
   * Seller stats: orders count and revenue for today, this week, this month (Section 5)
   */
  async getStats(ownerId: string) {
    const shop = await this.getSellerShop(ownerId);

    // Compute day/week/month boundaries in Uzbekistan local time (UTC+5, no DST)
    const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const localNow = new Date(Date.now() + TZ_OFFSET_MS);
    const year = localNow.getUTCFullYear();
    const month = localNow.getUTCMonth();
    const date = localNow.getUTCDate();
    const day = localNow.getUTCDay();

    // Start of today (00:00 Asia/Tashkent expressed as UTC Date)
    const startOfToday = new Date(Date.UTC(year, month, date) - TZ_OFFSET_MS);

    // Start of this week (Monday 00:00 Asia/Tashkent)
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(startOfToday.getTime() - daysSinceMonday * DAY_MS);

    // Start of this month (1st 00:00 Asia/Tashkent)
    const startOfMonth = new Date(Date.UTC(year, month, 1) - TZ_OFFSET_MS);

    // One aggregate per window, grouped by status, so the DB does the summing:
    //  - orderCount  = orders created in the window that were not cancelled (what the
    //    store panel labels "ta buyurtma");
    //  - revenueTiyin = delivered orders only — money actually collected, matching the
    //    admin panel's revenue definition (an accepted-but-delivered order is not revenue).
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
