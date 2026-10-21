import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AdminCategoryDto,
  AdminCreatePromoCodeDto,
  AdminCreateShopDto,
  AdminUpdateProductDto,
  AdminUpdatePromoCodeDto,
  AdminUpdateShopDto,
} from './admin.dto';
import { UserRole } from '@localshop/shared';
import { OrdersService } from '../orders/orders.service';
import { ShopsService } from '../shops/shops.service';
import { CategoriesService } from '../categories/categories.service';
import { AuditService } from './audit.service';

/** The admin performing a mutating action (for the audit trail). */
export interface AdminActor {
  id: string;
  ip?: string | null;
}

/** Uzbekistan local time offset (UTC+5, no DST) used for day buckets */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ORDER_STATUSES = ['new', 'accepted', 'on_the_way', 'delivered', 'cancelled'] as const;

/** Prisma select used to build the OrderSummary shape */
const ORDER_SUMMARY_SELECT = {
  id: true,
  status: true,
  payment_method: true,
  payment_status: true,
  total_amount: true,
  discount_amount: true,
  promo_code: true,
  customer_phone: true,
  created_at: true,
  shop: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

type OrderSummaryRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SUMMARY_SELECT }>;

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  phone: true,
  login: true,
  role: true,
  language: true,
  is_blocked: true,
  must_change_password: true,
  created_at: true,
} satisfies Prisma.UserSelect;

/** YYYY-MM-DD of a date in Tashkent local time */
function localDayKey(date: Date): string {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of local (Tashkent) midnight for a YYYY-MM-DD key */
function localDayStart(key: string): Date {
  return new Date(new Date(`${key}T00:00:00.000Z`).getTime() - TZ_OFFSET_MS);
}

function parsePagination(page?: string | number, limit?: string | number) {
  const p = Math.max(1, parseInt(String(page ?? '1'), 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(String(limit ?? '20'), 10) || 20));
  return { page: p, limit: l, skip: (p - 1) * l };
}

function parseDayKey(value: string | undefined, field: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value))) {
    throw new BadRequestException({ code: 'INVALID_DATE', message: `'${field}' must be YYYY-MM-DD` });
  }
  return value;
}

function generateTempPassword(length = 10): string {
  // Unambiguous alphabet; guarantee at least one letter of each case and a digit
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = lower + upper + digits;
  const chars = [
    lower[randomInt(lower.length)],
    upper[randomInt(upper.length)],
    digits[randomInt(digits.length)],
  ];
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface AdminOrderFilters {
  status?: string;
  shopId?: string;
  paymentMethod?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private shopsService: ShopsService,
    private categoriesService: CategoriesService,
    private audit: AuditService,
  ) {}

  // ───────────────────────────── helpers ─────────────────────────────

  /** Fields of a DTO that were actually sent (for `meta.fields` in the audit log). */
  private changedFields(dto: object): string[] {
    return Object.entries(dto).filter(([, v]) => v !== undefined).map(([k]) => k);
  }

  private toOrderSummary(order: OrderSummaryRow) {
    const { _count, ...rest } = order;
    return { ...rest, itemsCount: _count.items };
  }

  private async deliveredRevenueByShop(shopIds: string[], since?: Date) {
    if (shopIds.length === 0) return new Map<string, { sum: number; count: number }>();
    const rows = await this.prisma.order.groupBy({
      by: ['shop_id'],
      where: {
        shop_id: { in: shopIds },
        status: 'delivered',
        ...(since ? { created_at: { gte: since } } : {}),
      },
      _sum: { total_amount: true },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.shop_id, { sum: r._sum.total_amount ?? 0, count: r._count._all }]));
  }

  // ───────────────────────────── shops ─────────────────────────────

  /**
   * Admin creates a shop together with its shopkeeper account (Section 4 & 6)
   */
  async createShop(dto: AdminCreateShopDto, actor?: AdminActor) {
    const existingUser = await this.prisma.user.findUnique({
      where: { login: dto.seller_login },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'SELLER_LOGIN_EXISTS',
        message: `Username '${dto.seller_login}' is already in use. Please select another.`,
      });
    }

    // Default city (Tashkent) if not specified
    let cityId = dto.city_id;
    if (!cityId) {
      const city = await this.prisma.city.findFirst({ where: { is_active: true } });
      cityId = city ? city.id : '00000000-0000-0000-0000-000000000001';
    }

    const passwordHash = await bcrypt.hash(dto.seller_password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const seller = await tx.user.create({
        data: {
          login: dto.seller_login,
          phone: dto.phone,
          name: dto.seller_name || dto.name,
          password_hash: passwordHash,
          role: UserRole.SELLER as any,
          must_change_password: true, // As specified in TZ: must change on first login
          is_blocked: false,
        },
      });

      const shop = await tx.shop.create({
        data: {
          owner_id: seller.id,
          city_id: cityId,
          name: dto.name,
          phone: dto.phone,
          address_text: dto.address_text,
          lat: dto.lat,
          lng: dto.lng,
          open_time: dto.open_time || '08:00',
          close_time: dto.close_time || '23:00',
          is_open: true,
          is_active: true,
          commission_rate_percent: 0,
        },
        include: {
          owner: { select: { id: true, login: true, name: true, phone: true } },
          city: true,
        },
      });

      return shop;
    });

    if (actor) {
      await this.audit.log(actor.id, 'shop.create', {
        targetType: 'shop',
        targetId: created.id,
        meta: { name: created.name, seller_login: dto.seller_login },
        ip: actor.ip,
      });
    }
    return created;
  }

  private readonly shopOwnerSelect = {
    id: true,
    login: true,
    name: true,
    phone: true,
    is_blocked: true,
    must_change_password: true,
  } satisfies Prisma.UserSelect;

  async getShops(query: { q?: string; status?: string; page?: string; limit?: string }) {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const where: Prisma.ShopWhereInput = {};
    if (query.status === 'active') where.is_active = true;
    else if (query.status === 'inactive') where.is_active = false;
    else if (query.status === 'pending' || query.status === 'blocked') where.status = query.status as any;
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { address_text: { contains: q, mode: 'insensitive' } },
        { owner: { login: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [shops, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        include: {
          owner: { select: this.shopOwnerSelect },
          city: true,
          _count: { select: { products: { where: { deleted_at: null } }, orders: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shop.count({ where }),
    ]);

    const revenue = await this.deliveredRevenueByShop(shops.map((s) => s.id));

    return {
      data: shops.map(({ _count, ...shop }) => ({
        ...shop,
        productCount: _count.products,
        orderCount: _count.orders,
        revenueTiyin: revenue.get(shop.id)?.sum ?? 0,
        isCurrentlyOpen: shop.is_active && this.shopsService.isShopOpen(shop.open_time, shop.close_time, shop.is_open),
      })),
      total,
      page,
      limit,
    };
  }

  async getShop(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: { select: this.shopOwnerSelect },
        city: true,
        _count: { select: { products: { where: { deleted_at: null } }, orders: true } },
        products: {
          where: { deleted_at: null },
          include: { category: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }

    const todayStart = localDayStart(localDayKey(new Date()));
    const since30 = new Date(todayStart.getTime() - 29 * DAY_MS);
    const [revenueAll, ordersToday, orders30d, revenue30d] = await Promise.all([
      this.deliveredRevenueByShop([shopId]),
      this.prisma.order.count({ where: { shop_id: shopId, created_at: { gte: todayStart } } }),
      this.prisma.order.count({ where: { shop_id: shopId, created_at: { gte: since30 } } }),
      this.deliveredRevenueByShop([shopId], since30),
    ]);

    const { _count, ...rest } = shop;
    return {
      ...rest,
      productCount: _count.products,
      orderCount: _count.orders,
      revenueTiyin: revenueAll.get(shopId)?.sum ?? 0,
      isCurrentlyOpen: shop.is_active && this.shopsService.isShopOpen(shop.open_time, shop.close_time, shop.is_open),
      stats: {
        ordersToday,
        orders30d,
        revenue30dTiyin: revenue30d.get(shopId)?.sum ?? 0,
      },
    };
  }

  async updateShop(shopId: string, dto: AdminUpdateShopDto, actor?: AdminActor) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }

    const fields = [
      'name',
      'phone',
      'address_text',
      'lat',
      'lng',
      'open_time',
      'close_time',
      'is_open',
      'is_active',
      'commission_rate_percent',
      'logo_url',
    ] as const;
    const data: Prisma.ShopUpdateInput = {};
    for (const f of fields) {
      if (dto[f] !== undefined) (data as any)[f] = dto[f];
    }

    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data,
      include: {
        owner: { select: this.shopOwnerSelect },
        city: true,
      },
    });
    if (actor) {
      await this.audit.log(actor.id, 'shop.update', {
        targetType: 'shop',
        targetId: shopId,
        meta: { fields: Object.keys(data) },
        ip: actor.ip,
      });
    }
    return updated;
  }

  /** Shared implementation of approve / block / unblock: status transition + audit entry. */
  private async transitionShop(
    shopId: string,
    action: 'shop.approve' | 'shop.block' | 'shop.unblock',
    data: Prisma.ShopUpdateInput,
    actor?: AdminActor,
  ) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }
    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data,
      include: { owner: { select: this.shopOwnerSelect }, city: true },
    });
    if (actor) {
      await this.audit.log(actor.id, action, {
        targetType: 'shop',
        targetId: shopId,
        meta: { from: shop.status, to: updated.status },
        ip: actor.ip,
      });
    }
    return updated;
  }

  /**
   * Approves a self-registered (pending) shop: becomes visible to customers.
   */
  async approveShop(shopId: string, actor?: AdminActor) {
    return this.transitionShop(shopId, 'shop.approve', { status: 'active' as any, is_active: true, is_open: true }, actor);
  }

  /**
   * Blocks a shop (whether previously pending or active): hidden from customers.
   */
  async blockShop(shopId: string, actor?: AdminActor) {
    return this.transitionShop(shopId, 'shop.block', { status: 'blocked' as any, is_active: false }, actor);
  }

  /**
   * Unblocks a previously blocked shop, restoring it to active.
   */
  async unblockShop(shopId: string, actor?: AdminActor) {
    return this.transitionShop(shopId, 'shop.unblock', { status: 'active' as any, is_active: true }, actor);
  }

  async resetShopPassword(shopId: string, actor?: AdminActor) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: { owner: { select: { id: true, login: true } } },
    });
    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }
    if (!shop.owner.login) {
      throw new BadRequestException({ code: 'OWNER_HAS_NO_LOGIN', message: 'Shop owner has no login to reset.' });
    }

    const tempPassword = generateTempPassword(10);
    await this.prisma.user.update({
      where: { id: shop.owner.id },
      data: {
        password_hash: await bcrypt.hash(tempPassword, 10),
        must_change_password: true,
      },
    });

    if (actor) {
      // Never record the temporary password itself.
      await this.audit.log(actor.id, 'shop.reset_password', {
        targetType: 'shop',
        targetId: shopId,
        meta: { owner_id: shop.owner.id, login: shop.owner.login },
        ip: actor.ip,
      });
    }

    return { login: shop.owner.login, tempPassword };
  }

  // ───────────────────────────── products ─────────────────────────────

  private async findProductOrThrow(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deleted_at) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
    }
    return product;
  }

  async updateProduct(productId: string, dto: AdminUpdateProductDto, actor?: AdminActor) {
    const product = await this.findProductOrThrow(productId);
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.is_available !== undefined ? { is_available: dto.is_available } : {}),
      },
      include: { category: true },
    });
    if (actor) {
      await this.audit.log(actor.id, 'product.update', {
        targetType: 'product',
        targetId: productId,
        meta: {
          shop_id: product.shop_id,
          fields: this.changedFields(dto),
          ...(dto.is_available !== undefined ? { is_available: dto.is_available } : {}),
        },
        ip: actor.ip,
      });
    }
    return updated;
  }

  async deleteProduct(productId: string, actor?: AdminActor) {
    const product = await this.findProductOrThrow(productId);
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { deleted_at: new Date(), is_available: false },
      }),
      // Remove from any active carts so customers can't check it out
      this.prisma.cartItem.deleteMany({ where: { product_id: productId } }),
    ]);
    if (actor) {
      await this.audit.log(actor.id, 'product.delete', {
        targetType: 'product',
        targetId: productId,
        meta: { shop_id: product.shop_id, name_uz: product.name_uz },
        ip: actor.ip,
      });
    }
    return { success: true };
  }

  // ───────────────────────────── orders ─────────────────────────────

  async getOrders(filters: AdminOrderFilters) {
    const { page, limit, skip } = parsePagination(filters.page, filters.limit);
    const where: Prisma.OrderWhereInput = {};

    if (filters.status) {
      if (!(ORDER_STATUSES as readonly string[]).includes(filters.status)) {
        throw new BadRequestException({ code: 'INVALID_STATUS', message: `Unknown status '${filters.status}'` });
      }
      where.status = filters.status as any;
    }
    if (filters.shopId) where.shop_id = filters.shopId;
    if (filters.paymentMethod) {
      if (!['cash', 'online'].includes(filters.paymentMethod)) {
        throw new BadRequestException({ code: 'INVALID_PAYMENT_METHOD', message: `Unknown payment method '${filters.paymentMethod}'` });
      }
      where.payment_method = filters.paymentMethod as any;
    }

    const from = parseDayKey(filters.from, 'from');
    const to = parseDayKey(filters.to, 'to');
    if (from || to) {
      where.created_at = {
        ...(from ? { gte: localDayStart(from) } : {}),
        ...(to ? { lt: new Date(localDayStart(to).getTime() + DAY_MS) } : {}),
      };
    }

    const q = filters.q?.trim();
    if (q) {
      where.OR = [
        { id: { startsWith: q.toLowerCase() } },
        { customer_phone: { contains: q, mode: 'insensitive' } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: ORDER_SUMMARY_SELECT,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data: orders.map((o) => this.toOrderSummary(o)), total, page, limit };
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ...ORDER_SUMMARY_SELECT,
        address_snapshot: true,
        comment: true,
        commission_rate_percent: true,
        commission_amount: true,
        accepted_at: true,
        delivered_at: true,
        needs_attention: true,
        updated_at: true,
        shop: { select: { id: true, name: true, phone: true, address_text: true } },
        items: { orderBy: { created_at: 'asc' } },
        status_history: {
          orderBy: { created_at: 'asc' },
          include: { actor: { select: { id: true, name: true, login: true, role: true } } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    const { _count, items, status_history, ...rest } = order;
    return {
      ...rest,
      itemsCount: _count.items,
      items: items.map((i) => ({
        id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        unit_price: i.unit_price,
        quantity: i.quantity,
        total_price: i.unit_price * i.quantity,
      })),
      // Schema stores only the resulting `status`; from_status/to_status are derived for convenience
      status_history: status_history.map((h, idx) => ({
        id: h.id,
        status: h.status,
        from_status: idx > 0 ? status_history[idx - 1].status : null,
        to_status: h.status,
        reason: h.reason,
        created_at: h.created_at,
        changed_by: h.changed_by,
        actor: h.actor,
      })),
    };
  }

  async cancelOrder(orderId: string, adminId: string, reason: string, ip?: string | null) {
    await this.ordersService.adminCancelOrder(orderId, adminId, reason);
    await this.audit.log(adminId, 'order.cancel', { targetType: 'order', targetId: orderId, meta: { reason }, ip });
    return this.getOrder(orderId);
  }

  // ───────────────────────────── users ─────────────────────────────

  async getUsers(query: { q?: string; role?: string; blocked?: string; page?: string; limit?: string }) {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      if (!['customer', 'seller', 'admin'].includes(query.role)) {
        throw new BadRequestException({ code: 'INVALID_ROLE', message: `Unknown role '${query.role}'` });
      }
      where.role = query.role as any;
    }
    if (query.blocked === 'true') where.is_blocked = true;
    else if (query.blocked === 'false') where.is_blocked = false;

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { login: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_PUBLIC_SELECT,
          _count: { select: { orders: true } },
          shops: { select: { id: true, name: true }, take: 1, orderBy: { created_at: 'asc' } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const spent = await this.totalSpentByCustomer(users.map((u) => u.id));

    return {
      data: users.map(({ _count, shops, ...u }) => ({
        ...u,
        ordersCount: _count.orders,
        totalSpentTiyin: spent.get(u.id) ?? 0,
        shop: shops[0] ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  private async totalSpentByCustomer(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, number>();
    const rows = await this.prisma.order.groupBy({
      by: ['customer_id'],
      where: { customer_id: { in: userIds }, status: 'delivered' },
      _sum: { total_amount: true },
    });
    return new Map(rows.map((r) => [r.customer_id, r._sum.total_amount ?? 0]));
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_PUBLIC_SELECT,
        _count: { select: { orders: true } },
        shops: { select: { id: true, name: true }, take: 1, orderBy: { created_at: 'asc' } },
        addresses: { orderBy: { created_at: 'desc' } },
      },
    });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const [recentOrders, spent] = await Promise.all([
      this.prisma.order.findMany({
        where: { customer_id: userId },
        select: ORDER_SUMMARY_SELECT,
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      this.totalSpentByCustomer([userId]),
    ]);

    const { _count, shops, ...rest } = user;
    return {
      ...rest,
      ordersCount: _count.orders,
      totalSpentTiyin: spent.get(userId) ?? 0,
      shop: shops[0] ?? null,
      recentOrders: recentOrders.map((o) => this.toOrderSummary(o)),
    };
  }

  async toggleBlockUser(userId: string, isBlocked: boolean, actor?: AdminActor) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    if (isBlocked && user.role === ('admin' as any)) {
      throw new BadRequestException({ code: 'CANNOT_BLOCK_ADMIN', message: 'Admin accounts cannot be blocked.' });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { is_blocked: isBlocked },
      select: { id: true, login: true, phone: true, name: true, role: true, is_blocked: true },
    });
    if (actor) {
      await this.audit.log(actor.id, isBlocked ? 'user.block' : 'user.unblock', {
        targetType: 'user',
        targetId: userId,
        meta: { role: user.role },
        ip: actor.ip,
      });
    }
    return updated;
  }

  // ───────────────────────────── categories ─────────────────────────────

  async getCategories() {
    const categories = await this.prisma.category.findMany({
      include: { _count: { select: { products: { where: { deleted_at: null } } } } },
      orderBy: { name_uz: 'asc' },
    });
    return categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async createCategory(dto: AdminCategoryDto, actor?: AdminActor) {
    const category = await this.categoriesService.create(dto);
    if (actor) {
      await this.audit.log(actor.id, 'category.create', {
        targetType: 'category',
        targetId: category.id,
        meta: { name_uz: category.name_uz, parent_id: category.parent_id ?? null },
        ip: actor.ip,
      });
    }
    return category;
  }

  async updateCategory(categoryId: string, dto: Partial<AdminCategoryDto>, actor?: AdminActor) {
    const category = await this.categoriesService.update(categoryId, dto);
    if (actor) {
      await this.audit.log(actor.id, 'category.update', {
        targetType: 'category',
        targetId: categoryId,
        meta: { fields: this.changedFields(dto) },
        ip: actor.ip,
      });
    }
    return category;
  }

  async deleteCategory(categoryId: string, actor?: AdminActor) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }

    const activeCount = await this.prisma.product.count({ where: { category_id: categoryId, deleted_at: null } });
    if (activeCount > 0) {
      throw new ConflictException({
        code: 'CATEGORY_IN_USE',
        message: `Category is used by ${activeCount} product(s). Move or delete them first.`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Soft-deleted products without order history can be purged; ones referenced by orders must stay
      await tx.product.deleteMany({
        where: { category_id: categoryId, deleted_at: { not: null }, order_items: { none: {} } },
      });
      const archived = await tx.product.count({ where: { category_id: categoryId } });
      if (archived > 0) {
        throw new ConflictException({
          code: 'CATEGORY_IN_USE',
          message: `Category is still referenced by ${archived} archived product(s) with order history.`,
        });
      }
      await tx.category.updateMany({ where: { parent_id: categoryId }, data: { parent_id: null } });
      await tx.category.delete({ where: { id: categoryId } });
    });

    if (actor) {
      await this.audit.log(actor.id, 'category.delete', {
        targetType: 'category',
        targetId: categoryId,
        meta: { name_uz: category.name_uz },
        ip: actor.ip,
      });
    }
    return { success: true };
  }

  // ───────────────────────────── promo codes ─────────────────────────────

  async getPromoCodes() {
    return this.prisma.promoCode.findMany({ orderBy: { created_at: 'desc' } });
  }

  async createPromoCode(dto: AdminCreatePromoCodeDto, actor?: AdminActor) {
    const code = dto.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException({ code: 'INVALID_PROMO_CODE', message: 'Code must not be empty' });
    }
    let promo;
    try {
      promo = await this.prisma.promoCode.create({
        data: {
          code,
          description: dto.description?.trim() || null,
          discount_percent: dto.discount_percent,
          max_discount_tiyin: dto.max_discount_tiyin ?? null,
          min_order_tiyin: dto.min_order_tiyin ?? null,
          usage_limit: dto.usage_limit ?? null,
          is_active: dto.is_active ?? true,
          expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'PROMO_CODE_EXISTS', message: `Promo code '${code}' already exists.` });
      }
      throw e;
    }
    if (actor) {
      await this.audit.log(actor.id, 'promo.create', {
        targetType: 'promo',
        targetId: promo.id,
        meta: { code, discount_percent: dto.discount_percent },
        ip: actor.ip,
      });
    }
    return promo;
  }

  private async findPromoOrThrow(id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) {
      throw new NotFoundException({ code: 'PROMO_CODE_NOT_FOUND', message: 'Promo code not found' });
    }
    return promo;
  }

  async updatePromoCode(id: string, dto: AdminUpdatePromoCodeDto, actor?: AdminActor) {
    const promo = await this.findPromoOrThrow(id);
    const data: Prisma.PromoCodeUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.discount_percent !== undefined) data.discount_percent = dto.discount_percent;
    if (dto.max_discount_tiyin !== undefined) data.max_discount_tiyin = dto.max_discount_tiyin;
    if (dto.min_order_tiyin !== undefined) data.min_order_tiyin = dto.min_order_tiyin;
    if (dto.usage_limit !== undefined) data.usage_limit = dto.usage_limit;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;
    if (dto.expires_at !== undefined) data.expires_at = dto.expires_at ? new Date(dto.expires_at) : null;
    const updated = await this.prisma.promoCode.update({ where: { id }, data });
    if (actor) {
      await this.audit.log(actor.id, 'promo.update', {
        targetType: 'promo',
        targetId: id,
        meta: { code: promo.code, fields: Object.keys(data) },
        ip: actor.ip,
      });
    }
    return updated;
  }

  async deletePromoCode(id: string, actor?: AdminActor) {
    const promo = await this.findPromoOrThrow(id);
    await this.prisma.promoCode.delete({ where: { id } });
    if (actor) {
      await this.audit.log(actor.id, 'promo.delete', {
        targetType: 'promo',
        targetId: id,
        meta: { code: promo.code },
        ip: actor.ip,
      });
    }
    return { success: true };
  }

  // ───────────────────────────── dashboard ─────────────────────────────

  /**
   * Admin dashboard numbers, 30-day timeline, top shops and recent orders.
   * Day boundaries use Tashkent local time (UTC+5).
   */
  async getDashboardStats() {
    const todayKey = localDayKey(new Date());
    const todayStart = localDayStart(todayKey);
    const since30 = new Date(todayStart.getTime() - 29 * DAY_MS);

    const [
      customers,
      sellers,
      shops,
      activeShopsList,
      products,
      orders,
      ordersToday,
      deliveredAgg,
      deliveredTodayAgg,
      statusGroups,
      last30Orders,
      topShopRows,
      recentOrders,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'customer' } }),
      this.prisma.user.count({ where: { role: 'seller' } }),
      this.prisma.shop.count(),
      this.prisma.shop.findMany({
        where: { is_active: true },
        select: { open_time: true, close_time: true, is_open: true },
      }),
      this.prisma.product.count({ where: { deleted_at: null } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { created_at: { gte: todayStart } } }),
      this.prisma.order.aggregate({
        where: { status: 'delivered' },
        _sum: { total_amount: true, commission_amount: true },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: { status: 'delivered', created_at: { gte: todayStart } },
        _sum: { total_amount: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.findMany({
        where: { created_at: { gte: since30 } },
        select: { created_at: true, total_amount: true, status: true },
      }),
      this.prisma.order.groupBy({
        by: ['shop_id'],
        where: { status: 'delivered', created_at: { gte: since30 } },
        _sum: { total_amount: true },
        _count: { _all: true },
        orderBy: { _sum: { total_amount: 'desc' } },
        take: 5,
      }),
      this.prisma.order.findMany({ select: ORDER_SUMMARY_SELECT, orderBy: { created_at: 'desc' }, take: 8 }),
    ]);

    const ordersByStatus: Record<string, number> = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
    for (const g of statusGroups) ordersByStatus[g.status] = g._count._all;

    const revenueTiyin = deliveredAgg._sum.total_amount ?? 0;
    const deliveredCount = deliveredAgg._count._all;

    const dayMap = new Map<string, { date: string; orders: number; revenueTiyin: number }>();
    for (let i = 0; i < 30; i++) {
      const key = localDayKey(new Date(since30.getTime() + i * DAY_MS));
      dayMap.set(key, { date: key, orders: 0, revenueTiyin: 0 });
    }
    for (const o of last30Orders) {
      const entry = dayMap.get(localDayKey(o.created_at));
      if (!entry) continue;
      entry.orders += 1;
      if (o.status === 'delivered') entry.revenueTiyin += o.total_amount;
    }

    const topShopNames = await this.prisma.shop.findMany({
      where: { id: { in: topShopRows.map((r) => r.shop_id) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(topShopNames.map((s) => [s.id, s.name]));

    return {
      totals: {
        customers,
        sellers,
        shops,
        activeShops: activeShopsList.length,
        openShopsNow: activeShopsList.filter((s) => this.shopsService.isShopOpen(s.open_time, s.close_time, s.is_open)).length,
        products,
        orders,
        ordersToday,
        revenueTiyin,
        revenueTodayTiyin: deliveredTodayAgg._sum.total_amount ?? 0,
        commissionTiyin: deliveredAgg._sum.commission_amount ?? 0,
        avgOrderTiyin: deliveredCount > 0 ? Math.round(revenueTiyin / deliveredCount) : 0,
        cancelRatePercent: orders > 0 ? Math.round((ordersByStatus.cancelled / orders) * 1000) / 10 : 0,
      },
      ordersByStatus,
      daily: Array.from(dayMap.values()),
      topShops: topShopRows.map((r) => ({
        id: r.shop_id,
        name: nameById.get(r.shop_id) ?? '',
        orders: r._count._all,
        revenueTiyin: r._sum.total_amount ?? 0,
      })),
      recentOrders: recentOrders.map((o) => this.toOrderSummary(o)),
    };
  }
}
