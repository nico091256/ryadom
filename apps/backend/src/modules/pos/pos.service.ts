import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { OrderStatus, UserRole } from '@localshop/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';
import { OrdersService } from '../orders/orders.service';
import { PosOrderStatusDto, PosPendingOrdersQueryDto, PosSaleItemDto, PosSyncItemDto } from './pos.dto';
import { PosWebhookService } from './pos-webhook.service';
import { CategoryRef, matchCategoryId } from './regos.util';

/** The shop PosApiKeyGuard attached to the request. */
export interface PosShopRef {
  id: string;
  owner_id: string;
}

export interface PosSyncResult {
  updated: number;
  created?: number;
  /** Items whose barcode/sku matched no product of this shop and had no name to auto-create. */
  not_found: { barcode?: string; sku?: string }[];
  skipped: { barcode?: string; sku?: string; reason: string }[];
}

function codeKey(item: PosSyncItemDto): { barcode?: string; sku?: string } {
  return {
    ...(item.barcode ? { barcode: item.barcode.trim() } : {}),
    ...(item.sku ? { sku: item.sku.trim() } : {}),
  };
}

/**
 * What a cash register may do with its shop: bulk price/stock/catalog sync, pulling
 * orders it has not seen yet, and moving orders through the seller lifecycle.
 * Status changes go through OrdersService so the state machine, stock
 * restoration, notifications and audit trail stay in one place.
 */
@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  /**
   * Matches each item by barcode first, then by sku (both scoped to the shop,
   * soft-deleted products excluded). If the product exists, updates sent fields.
   * If the code is not found and a product name (`name` or `name_uz`) is provided,
   * auto-creates the product in the shop and matches its category.
   */
  async syncProducts(shop: PosShopRef, items: PosSyncItemDto[]): Promise<PosSyncResult> {
    const result: PosSyncResult = { updated: 0, created: 0, not_found: [], skipped: [] };

    const barcodes = [...new Set(items.map((i) => i.barcode?.trim()).filter((v): v is string => !!v))];
    const skus = [...new Set(items.map((i) => i.sku?.trim()).filter((v): v is string => !!v))];

    const products =
      barcodes.length || skus.length
        ? await this.prisma.product.findMany({
            where: {
              shop_id: shop.id,
              deleted_at: null,
              OR: [
                ...(barcodes.length ? [{ barcode: { in: barcodes } }] : []),
                ...(skus.length ? [{ sku: { in: skus } }] : []),
              ],
            },
            select: { id: true, barcode: true, sku: true },
          })
        : [];
    const byBarcode = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode as string, p.id]));
    const bySku = new Map(products.filter((p) => p.sku).map((p) => [p.sku as string, p.id]));

    let categoriesCache: CategoryRef[] | null = null;
    const getCategories = async (): Promise<CategoryRef[]> => {
      if (categoriesCache) return categoriesCache;
      categoriesCache = (await this.prisma.category?.findMany?.()) ?? [];
      return categoriesCache;
    };

    for (const item of items) {
      const key = codeKey(item);
      if (!key.barcode && !key.sku) {
        result.skipped.push({ reason: 'barcode or sku is required' });
        continue;
      }
      const primaryName = (item.name_uz || item.name || item.name_ru || item.name_en || '').trim();
      const data: Record<string, any> = {
        ...(item.price !== undefined ? { price: item.price } : {}),
        ...(item.stock !== undefined ? { stock: item.stock } : {}),
        ...(item.is_available !== undefined ? { is_available: item.is_available } : {}),
        ...(primaryName ? { name_uz: primaryName } : {}),
        ...(item.name_ru ? { name_ru: item.name_ru.trim() } : {}),
        ...(item.name_en ? { name_en: item.name_en.trim() } : {}),
        ...(item.description_uz !== undefined ? { description_uz: item.description_uz } : {}),
        ...(item.image_url !== undefined ? { image_url: item.image_url } : {}),
      };
      if (Object.keys(data).length === 0) {
        result.skipped.push({ ...key, reason: 'nothing to update (send price, stock or is_available)' });
        continue;
      }
      const id = (key.barcode && byBarcode.get(key.barcode)) || (key.sku && bySku.get(key.sku)) || null;
      if (!id) {
        if (!primaryName) {
          result.not_found.push(key);
          continue;
        }
        const cats = await getCategories();
        const fallbackCatId = cats[0]?.id ?? 'c-1';
        const resolvedCatId =
          item.category_id && cats.some((c) => c.id === item.category_id)
            ? item.category_id
            : matchCategoryId(item.category_name, cats, fallbackCatId);

        const created = await this.prisma.product.create({
          data: {
            shop_id: shop.id,
            category_id: resolvedCatId,
            name_uz: primaryName,
            name_ru: item.name_ru?.trim() || primaryName,
            name_en: item.name_en?.trim() || primaryName,
            description_uz: item.description_uz ?? null,
            description_ru: item.description_uz ?? null,
            description_en: item.description_uz ?? null,
            price: item.price ?? 0,
            stock: item.stock ?? 0,
            is_available: item.is_available ?? (item.stock ?? 0) > 0,
            barcode: key.barcode ?? null,
            sku: key.sku ?? null,
            image_url: item.image_url ?? null,
          },
        });
        if (key.barcode) byBarcode.set(key.barcode, created.id);
        if (key.sku) bySku.set(key.sku, created.id);
        result.created = (result.created ?? 0) + 1;
        continue;
      }
      await this.prisma.product.update({ where: { id }, data });
      result.updated++;
    }

    if (result.updated > 0 || (result.created ?? 0) > 0) await this.invalidateShopCache(shop.id);
    return result;
  }

  /**
   * Records an in-store POS checkout sale by decrementing each matched product's
   * stock (floored at 0) so the seller panel and mobile client immediately reflect
   * remaining inventory.
   */
  async recordSale(shop: PosShopRef, items: PosSaleItemDto[]): Promise<PosSyncResult> {
    const result: PosSyncResult = { updated: 0, not_found: [], skipped: [] };

    const barcodes = [...new Set(items.map((i) => i.barcode?.trim()).filter((v): v is string => !!v))];
    const skus = [...new Set(items.map((i) => i.sku?.trim()).filter((v): v is string => !!v))];

    const products =
      barcodes.length || skus.length
        ? await this.prisma.product.findMany({
            where: {
              shop_id: shop.id,
              deleted_at: null,
              OR: [
                ...(barcodes.length ? [{ barcode: { in: barcodes } }] : []),
                ...(skus.length ? [{ sku: { in: skus } }] : []),
              ],
            },
            select: { id: true, barcode: true, sku: true, stock: true },
          })
        : [];
    const byBarcode = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode as string, p]));
    const bySku = new Map(products.filter((p) => p.sku).map((p) => [p.sku as string, p]));

    for (const item of items) {
      const key = {
        ...(item.barcode ? { barcode: item.barcode.trim() } : {}),
        ...(item.sku ? { sku: item.sku.trim() } : {}),
      };
      if (!key.barcode && !key.sku) {
        result.skipped.push({ reason: 'barcode or sku is required' });
        continue;
      }
      const prod = (key.barcode && byBarcode.get(key.barcode)) || (key.sku && bySku.get(key.sku)) || null;
      if (!prod) {
        result.not_found.push(key);
        continue;
      }
      const nextStock = Math.max(0, prod.stock - item.quantity);
      prod.stock = nextStock;
      await this.prisma.product.update({
        where: { id: prod.id },
        data: { stock: nextStock },
      });
      result.updated++;
    }

    if (result.updated > 0) await this.invalidateShopCache(shop.id);
    return result;
  }

  /** Orders in one lifecycle state, oldest first, in the same shape the webhook sends. */
  async pendingOrders(shop: PosShopRef, query: PosPendingOrdersQueryDto) {
    const status = query.status ?? 'new';
    const limit = query.limit ?? 50;
    const rows = await this.prisma.order.findMany({
      where: { shop_id: shop.id, status: status as any },
      include: { items: true, customer: { select: { name: true } } },
      orderBy: { created_at: 'asc' },
      take: limit,
    });
    return { status, count: rows.length, orders: rows.map((o) => PosWebhookService.toOrderPayload(o)) };
  }

  /** Same transitions the seller panel performs, attributed to the shop owner. */
  async updateOrderStatus(shop: PosShopRef, orderId: string, dto: PosOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, shop_id: true } });
    if (!order || order.shop_id !== shop.id) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found in this shop' });
    }
    switch (dto.status) {
      case 'accepted':
        return this.orders.acceptOrder(orderId, shop.owner_id);
      case 'cancelled':
        return this.orders.cancelOrder(orderId, shop.owner_id, UserRole.SELLER, { reason: dto.reason });
      default:
        return this.orders.updateStatus(orderId, shop.owner_id, { status: dto.status as unknown as OrderStatus });
    }
  }

  private async invalidateShopCache(shopId: string) {
    if (!this.cache) return;
    await Promise.all([this.cache.del(`shop:${shopId}:profile`), this.cache.delPattern('nearby:*')]);
  }
}
