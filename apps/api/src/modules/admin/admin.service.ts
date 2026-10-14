import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminCategoryDto, AdminCreateShopDto, AdminUpdateShopDto } from './admin.dto';
import { UserRole } from '@localshop/shared';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin creates a shop together with its shopkeeper account (Section 4 & 6)
   */
  async createShop(dto: AdminCreateShopDto) {
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

    return this.prisma.$transaction(async (tx) => {
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
  }

  async getShops() {
    return this.prisma.shop.findMany({
      include: {
        owner: { select: { id: true, login: true, name: true, phone: true, is_blocked: true } },
        city: true,
        _count: {
          select: { products: true, orders: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateShop(shopId: string, dto: AdminUpdateShopDto) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }

    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address_text !== undefined ? { address_text: dto.address_text } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        ...(dto.is_open !== undefined ? { is_open: dto.is_open } : {}),
        ...(dto.commission_rate_percent !== undefined ? { commission_rate_percent: dto.commission_rate_percent } : {}),
      },
      include: {
        owner: { select: { id: true, login: true, name: true, phone: true } },
        city: true,
      },
    });
  }

  async getUsers(search?: string, role?: UserRole) {
    return this.prisma.user.findMany({
      where: {
        ...(role ? { role: role as any } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { login: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        login: true,
        phone: true,
        name: true,
        role: true,
        language: true,
        is_blocked: true,
        must_change_password: true,
        created_at: true,
        _count: {
          select: { orders: true, shops: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async toggleBlockUser(userId: string, isBlocked: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { is_blocked: isBlocked },
      select: { id: true, login: true, phone: true, name: true, is_blocked: true },
    });
  }

  /**
   * Admin dashboard numbers and 30-day timeline
   */
  async getDashboardStats() {
    const [totalOrders, totalShops, totalCustomers, totalSellers, needsAttentionCount] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.shop.count({ where: { is_active: true } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER as any } }),
      this.prisma.user.count({ where: { role: UserRole.SELLER as any } }),
      this.prisma.order.count({ where: { needs_attention: true, status: 'new' } }),
    ]);

    // Orders in the last 30 days grouped by day
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentOrders = await this.prisma.order.findMany({
      where: {
        created_at: { gte: thirtyDaysAgo },
      },
      select: {
        created_at: true,
        total_amount: true,
        status: true,
      },
    });

    const dayMap = new Map<string, { date: string; orderCount: number; revenueTiyin: number }>();

    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split('T')[0];
      dayMap.set(key, { date: key, orderCount: 0, revenueTiyin: 0 });
    }

    for (const order of recentOrders) {
      const key = order.created_at.toISOString().split('T')[0];
      const entry = dayMap.get(key);
      if (entry) {
        entry.orderCount += 1;
        if (order.status !== 'cancelled') {
          entry.revenueTiyin += order.total_amount;
        }
      }
    }

    return {
      summary: {
        totalOrders,
        totalShops,
        totalCustomers,
        totalSellers,
        needsAttentionCount,
      },
      ordersPerDayLast30Days: Array.from(dayMap.values()),
    };
  }
}
