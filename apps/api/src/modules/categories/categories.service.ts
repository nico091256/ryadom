import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        children: true,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
  }

  async create(data: { name_uz: string; name_ru?: string; name_en?: string; icon_url?: string; parent_id?: string }) {
    return this.prisma.category.create({
      data: {
        name_uz: data.name_uz,
        name_ru: data.name_ru || data.name_uz,
        name_en: data.name_en || data.name_uz,
        icon_url: data.icon_url,
        parent_id: data.parent_id,
      },
    });
  }

  async update(id: string, data: Partial<{ name_uz: string; name_ru: string; name_en: string; icon_url: string; parent_id: string }>) {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }
}
