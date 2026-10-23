import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CacheService } from '../../common/redis/cache.service';

export const CATEGORIES_CACHE_KEY = 'categories:all';
const CATEGORIES_TTL = 86400; // 24 hours

export interface UpdateCategoryInput {
  name_uz?: string;
  name_ru?: string;
  name_en?: string;
  icon_url?: string | null;
  /** `null` detaches the category from its parent. */
  parent_id?: string | null;
}

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

  /**
   * Builds the Prisma update field by field instead of spreading the body, so
   * only the five editable columns can ever reach the database.
   */
  async update(id: string, input: UpdateCategoryInput) {
    if (input.parent_id !== undefined && input.parent_id !== null && input.parent_id === id) {
      throw new BadRequestException({ code: 'INVALID_PARENT', message: 'A category cannot be its own parent.' });
    }

    // Unchecked input on purpose: the scalar `parent_id` (null = detach) is applied
    // identically by Postgres and the in-memory dev store, whereas a relation
    // `parent: { connect | disconnect }` is not understood by the memory store.
    // An unknown parent fails the FK (P2003 -> 400 INVALID_REFERENCE in the filter).
    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (input.name_uz !== undefined) data.name_uz = input.name_uz;
    if (input.name_ru !== undefined) data.name_ru = input.name_ru;
    if (input.name_en !== undefined) data.name_en = input.name_en;
    if (input.icon_url !== undefined) data.icon_url = input.icon_url;
    if (input.parent_id !== undefined) data.parent_id = input.parent_id;

    const res = await this.prisma.category.update({
      where: { id },
      data,
    });
    await this.cache.del(CATEGORIES_CACHE_KEY);
    return res;
  }
}
