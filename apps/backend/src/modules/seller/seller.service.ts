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
  PosBulkImportDto,
  RegosSyncDto,
  SELLER_PRODUCTS_DEFAULT_LIMIT,
  SELLER_PRODUCTS_MAX_LIMIT,
  SELLER_PRODUCTS_UNPAGED_CAP,
  UpdatePosSettingsDto,
  UpdateProductDto,
  UpdateShopProfileDto,
} from './seller.dto';
import { OrderStatus } from '@localshop/shared';
import { POS_API_KEY_PREFIX, PosType } from '../pos/pos.constants';
import { isSafeWebhookUrl } from '../pos/pos-webhook.service';
import {
  CategoryRef,
  DEMO_REGOS_ITEMS,
  matchCategoryId,
  normalizeRegosItem,
  resolveRegosGatewayUrl,
  resolveYesPosTarget,
} from '../pos/regos.util';

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
  ) { }

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
        ...(dto.logo_url !== undefined ? { logo_url: dto.logo_url || null } : {}),
        ...(dto.banner_url !== undefined ? { banner_url: dto.banner_url || null } : {}),
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
   * Connects to REGOS.Online Gateway (`POST .../v1/item/getext`) or YES POS (`yespos.uz`) API,
   * or uses the built-in demo catalog when `integration_key === 'demo'`, normalizes prices (so'm -> tiyin)
   * and stock, matches categories, and upserts all products into the seller's shop.
   */
  async syncFromRegos(ownerId: string, dto: RegosSyncDto) {
    const shop = await this.getSellerShop(ownerId);
    const targetPosType: PosType = dto.pos_type ?? (shop.pos_type === 'yespos' ? 'yespos' : 'regos');

    let rawItems: Record<string, any>[] = [];
    let sourceLabel = 'regos_api';

    if (targetPosType === 'yespos') {
      let target: ReturnType<typeof resolveYesPosTarget>;
      try {
        target = resolveYesPosTarget(dto.integration_key);
      } catch (e: any) {
        throw new BadRequestException({
          code: 'YESPOS_INVALID_KEY',
          message: e?.message || "YES POS integratsiya kaliti noto'g'ri.",
        });
      }
      if (target.mode === 'demo') {
        rawItems = DEMO_REGOS_ITEMS;
        sourceLabel = 'yespos_demo';
      } else {
        rawItems = await this.fetchYesPosCatalog(target.url, target.token, {
          stock_id: dto.stock_id,
        });
        sourceLabel = 'yespos_api';
      }
    } else {
      let gatewayUrl: string;
      try {
        gatewayUrl = resolveRegosGatewayUrl(dto.integration_key);
      } catch (e: any) {
        throw new BadRequestException({
          code: 'REGOS_INVALID_KEY',
          message: e?.message || "REGOS integratsiya kaliti noto'g'ri.",
        });
      }

      if (gatewayUrl === 'demo') {
        rawItems = DEMO_REGOS_ITEMS;
        sourceLabel = 'regos_demo';
      } else {
        rawItems = await this.fetchRegosCatalog(gatewayUrl, {
          stock_id: dto.stock_id,
          price_type_id: dto.price_type_id,
        });
        sourceLabel = 'regos_api';
      }
    }

    if (shop.pos_type !== targetPosType) {
      await this.prisma.shop.update({
        where: { id: shop.id },
        data: { pos_type: targetPosType },
      });
    }

    const stats = await this.upsertPosCatalog(shop.id, rawItems, {
      defaultCategoryId: dto.default_category_id,
      priceInSom: true,
    });

    return {
      source: sourceLabel,
      ...stats,
    };
  }

  private async fetchYesPosCatalog(
    url: string,
    token?: string,
    opts?: { stock_id?: number },
  ): Promise<Record<string, any>[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, 'X-API-Key': token } : {}),
      };
      const reqUrl = new URL(url);
      if (opts?.stock_id && !reqUrl.searchParams.has('branch_id')) {
        reqUrl.searchParams.set('branch_id', String(opts.stock_id));
      }
      const res = await fetch(reqUrl.toString(), {
        method: 'GET',
        headers,
        redirect: 'error',
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (${res.statusText})`);
      }
      const body: any = await res.json();
      if (Array.isArray(body)) return body;
      if (Array.isArray(body?.data)) return body.data;
      if (Array.isArray(body?.result)) return body.result;
      if (Array.isArray(body?.items)) return body.items;
      if (Array.isArray(body?.products)) return body.products;
      if (Array.isArray(body?.data?.items)) return body.data.items;
      return [];
    } catch (err: any) {
      throw new BadRequestException({
        code: 'YESPOS_CONNECTION_FAILED',
        message: `YES POS serveriga ulanib bo'lmadi (${err?.message || 'tarmoq xatosi'}). API kalitni tekshiring yoki "demo" rejimida sinab ko'ring.`,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Bulk imports/upserts products from a REGOS CSV or JSON export uploaded in the store panel.
   */
  async bulkImportPosItems(ownerId: string, dto: PosBulkImportDto) {
    const shop = await this.getSellerShop(ownerId);
    const stats = await this.upsertPosCatalog(shop.id, dto.items, {
      defaultCategoryId: dto.default_category_id,
      priceInSom: dto.price_in_som ?? true,
    });
    return {
      source: 'file_import',
      ...stats,
    };
  }

  private async fetchRegosCatalog(
    gatewayUrl: string,
    opts: { stock_id?: number; price_type_id?: number },
  ): Promise<Record<string, any>[]> {
    const filters: { Field: string; Operator: string; Value: number }[] = [];
    if (opts.stock_id) filters.push({ Field: 'stock_id', Operator: 'Equal', Value: opts.stock_id });
    if (opts.price_type_id) filters.push({ Field: 'price_type_id', Operator: 'Equal', Value: opts.price_type_id });

    const PAGE_SIZE = 500;
    const MAX_PAGES = 5; // Up to 2,500 products per sync

    const callMethod = async (methodPath: string, offset: number) => {
      const payload: Record<string, any> = {
        limit: PAGE_SIZE,
        offset,
        ...(opts.stock_id ? { stock_id: opts.stock_id } : {}),
        ...(opts.price_type_id ? { price_type_id: opts.price_type_id } : {}),
        ...(filters.length > 0 ? { filters } : {}),
      };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(`${gatewayUrl}/${methodPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
          redirect: 'error',
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} (${res.statusText})`);
        }
        return (await res.json()) as { ok?: boolean; result?: any; description?: string };
      } finally {
        clearTimeout(timeout);
      }
    };

    const allItems: Record<string, any>[] = [];
    let resolvedMethod: 'item/getext' | 'item/get' = 'item/getext';

    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_SIZE;
      let body: { ok?: boolean; result?: any; description?: string };
      try {
        body = await callMethod(resolvedMethod, offset);
        if (page === 0 && body && body.ok === false) {
          resolvedMethod = 'item/get';
          body = await callMethod(resolvedMethod, offset);
        }
      } catch (err: any) {
        if (page > 0 && allItems.length > 0) break;
        throw new BadRequestException({
          code: 'REGOS_CONNECTION_FAILED',
          message: `REGOS serveriga ulanib bo'lmadi (${err?.message || 'tarmoq xatosi'}). Integratsiya kalitini tekshiring yoki "demo" rejimida sinab ko'ring.`,
        });
      }

      if (body?.ok === false) {
        if (page > 0 && allItems.length > 0) break;
        throw new BadRequestException({
          code: 'REGOS_API_ERROR',
          message: `REGOS API xatoligi: ${body.description || 'Noma\'lum xato'}`,
        });
      }

      const list = Array.isArray(body?.result)
        ? body.result
        : Array.isArray(body)
          ? body
          : [];
      allItems.push(...list);

      if (list.length < PAGE_SIZE) {
        break;
      }
    }

    return allItems;
  }

  private async upsertPosCatalog(
    shopId: string,
    rawItems: Record<string, any>[],
    options: { defaultCategoryId?: string; priceInSom: boolean },
  ) {
    const categories: CategoryRef[] = (await this.prisma.category.findMany()) ?? [];
    const fallbackCatId =
      options.defaultCategoryId && categories.some((c) => c.id === options.defaultCategoryId)
        ? options.defaultCategoryId
        : categories[0]?.id ?? 'c-1';

    const existing = await this.prisma.product.findMany({
      where: { shop_id: shopId, deleted_at: null },
      select: { id: true, barcode: true, sku: true, name_uz: true, image_url: true, description_uz: true },
    });

    type ExistingEntry = (typeof existing)[number];
    const byBarcode = new Map<string, ExistingEntry>();
    const bySku = new Map<string, ExistingEntry>();
    const byName = new Map<string, ExistingEntry>();

    for (const prod of existing) {
      if (prod.barcode) byBarcode.set(prod.barcode, prod);
      if (prod.sku) bySku.set(prod.sku, prod);
      if (prod.name_uz) byName.set(prod.name_uz.trim().toLowerCase(), prod);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const toCreate: Record<string, any>[] = [];
    const toUpdate = new Map<string, Record<string, any>>();
    const pendingCreateByBarcode = new Map<string, Record<string, any>>();
    const pendingCreateBySku = new Map<string, Record<string, any>>();
    const pendingCreateByName = new Map<string, Record<string, any>>();

    for (const raw of rawItems) {
      const item = normalizeRegosItem(raw, { priceInSom: options.priceInSom });
      if (!item) {
        skipped++;
        continue;
      }

      const nameKey = item.name_uz.trim().toLowerCase();
      const match =
        (item.barcode ? byBarcode.get(item.barcode) : undefined) ||
        (item.sku ? bySku.get(item.sku) : undefined) ||
        byName.get(nameKey);

      if (match) {
        const prevUpdate = toUpdate.get(match.id) ?? {};
        const updateData: Record<string, any> = {
          ...prevUpdate,
          price: item.price,
          stock: item.stock,
          is_available: item.is_available,
          name_uz: item.name_uz,
        };
        if (!match.barcode && item.barcode && !byBarcode.has(item.barcode) && !pendingCreateByBarcode.has(item.barcode)) {
          updateData.barcode = item.barcode;
          match.barcode = item.barcode;
          byBarcode.set(item.barcode, match);
        }
        if (!match.sku && item.sku) {
          updateData.sku = item.sku;
          match.sku = item.sku;
          bySku.set(item.sku, match);
        }
        if (!match.image_url && item.image_url) {
          updateData.image_url = item.image_url;
          match.image_url = item.image_url;
        }
        if (!match.description_uz && item.description_uz) {
          updateData.description_uz = item.description_uz;
          match.description_uz = item.description_uz;
        }

        if (!toUpdate.has(match.id)) {
          updated++;
        }
        toUpdate.set(match.id, updateData);
        byName.set(nameKey, match);
        continue;
      }

      // Check if an earlier item in the same batch already queued creation for this barcode/sku/name
      const pending =
        (item.barcode ? pendingCreateByBarcode.get(item.barcode) : undefined) ||
        (item.sku ? pendingCreateBySku.get(item.sku) : undefined) ||
        pendingCreateByName.get(nameKey);

      if (pending) {
        pending.price = item.price;
        pending.stock = item.stock;
        pending.is_available = item.is_available;
        if (!pending.image_url && item.image_url) pending.image_url = item.image_url;
        if (!pending.description_uz && item.description_uz) {
          pending.description_uz = item.description_uz;
          pending.description_ru = item.description_uz;
          pending.description_en = item.description_uz;
        }
        continue;
      }

      const categoryId =
        item.category_id && categories.some((c) => c.id === item.category_id)
          ? item.category_id
          : matchCategoryId(item.group_name, categories, fallbackCatId);

      const safeBarcode =
        item.barcode && !byBarcode.has(item.barcode) && !pendingCreateByBarcode.has(item.barcode)
          ? item.barcode
          : null;

      const createRow = {
        shop_id: shopId,
        category_id: categoryId,
        name_uz: item.name_uz,
        name_ru: item.name_ru || item.name_uz,
        name_en: item.name_en || item.name_uz,
        description_uz: item.description_uz,
        description_ru: item.description_uz,
        description_en: item.description_uz,
        price: item.price,
        stock: item.stock,
        is_available: item.is_available,
        barcode: safeBarcode,
        sku: item.sku,
        image_url: item.image_url,
      };

      toCreate.push(createRow);
      if (safeBarcode) pendingCreateByBarcode.set(safeBarcode, createRow);
      if (item.sku) pendingCreateBySku.set(item.sku, createRow);
      pendingCreateByName.set(nameKey, createRow);
      created++;
    }

    // Batch insert new products (250 per query via createMany, or concurrent create fallback)
    const CREATE_BATCH = 250;
    for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
      const chunk = toCreate.slice(i, i + CREATE_BATCH);
      if (typeof this.prisma.product.createMany === 'function') {
        await this.prisma.product.createMany({
          data: chunk as any,
          skipDuplicates: true,
        });
      } else {
        await Promise.all(chunk.map((data) => this.prisma.product.create({ data: data as any })));
      }
    }

    // Batch update existing products in chunks of 50 concurrent queries
    const updateEntries = Array.from(toUpdate.entries());
    const UPDATE_BATCH = 50;
    for (let i = 0; i < updateEntries.length; i += UPDATE_BATCH) {
      const chunk = updateEntries.slice(i, i + UPDATE_BATCH);
      await Promise.all(
        chunk.map(([id, data]) =>
          this.prisma.product.update({
            where: { id },
            data,
          }),
        ),
      );
    }

    if (created > 0 || updated > 0) {
      await this.invalidateShopCache(shopId);
    }

    return {
      created,
      updated,
      skipped,
      total: created + updated + skipped,
    };
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
          ...(dto.description_uz !== undefined ? { description_uz: dto.description_uz || null } : {}),
          ...(dto.description_ru !== undefined ? { description_ru: dto.description_ru || null } : {}),
          ...(dto.description_en !== undefined ? { description_en: dto.description_en || null } : {}),
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
