import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';

const CATEGORIES_CACHE_KEY = 'categories:all';
const CATEGORIES_TTL = 86400; // 24 hours

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll() {
    return this.cache.wrap(
      CATEGORIES_CACHE_KEY,
      () =>
        this.prisma.category.findMany({
          include: {
            children: true,
          },
          orderBy: { created_at: 'asc' },
        }),
      CATEGORIES_TTL,
    );
  }

  async findOne(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
  }

  async create(data: { name_uz: string; name_ru?: string; name_en?: string; icon_url?: string; parent_id?: string }) {
    const res = await this.prisma.category.create({
      data: {
        name_uz: data.name_uz,
        name_ru: data.name_ru || data.name_uz,
        name_en: data.name_en || data.name_uz,
        icon_url: data.icon_url,
        parent_id: data.parent_id,
      },
    });
    await this.cache.del(CATEGORIES_CACHE_KEY);
    return res;
  }

  async update(id: string, data: Partial<{ name_uz: string; name_ru: string; name_en: string; icon_url: string; parent_id: string }>) {
    const res = await this.prisma.category.update({
      where: { id },
      data,
    });
    await this.cache.del(CATEGORIES_CACHE_KEY);
    return res;
  }
}
