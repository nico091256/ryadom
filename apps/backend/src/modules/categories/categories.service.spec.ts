import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CategoriesService } from './categories.service';
import { AdminUpdateCategoryDto } from '../admin/admin.dto';

describe('CategoriesService.update', () => {
  let prisma: any;
  let cache: any;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = { category: { update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'c1', ...data })) } };
    cache = { del: jest.fn().mockResolvedValue(undefined), wrap: jest.fn() };
    service = new CategoriesService(prisma, cache);
  });

  it('writes only the editable columns, never the raw body', async () => {
    await service.update('c1', { name_uz: 'Non', icon_url: null, extra: 'x', id: 'hacked' } as any);

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name_uz: 'Non', icon_url: null },
    });
    expect(cache.del).toHaveBeenCalledWith('categories:all');
  });

  it('parent_id: null detaches, a string re-parents', async () => {
    await service.update('c1', { parent_id: null });
    expect(prisma.category.update.mock.calls[0][0].data).toEqual({ parent_id: null });

    await service.update('c1', { parent_id: 'root' });
    expect(prisma.category.update.mock.calls[1][0].data).toEqual({ parent_id: 'root' });
  });

  it('rejects a category being its own parent with 400 INVALID_PARENT', async () => {
    const err = await service.update('c1', { parent_id: 'c1' }).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse().code).toBe('INVALID_PARENT');
    expect(prisma.category.update).not.toHaveBeenCalled();
  });
});

describe('AdminUpdateCategoryDto', () => {
  it('accepts a partial body with nullable icon_url / parent_id', async () => {
    const dto = plainToInstance(AdminUpdateCategoryDto, { name_ru: 'Хлеб', icon_url: null, parent_id: null });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });

  it('rejects over-long names, non-string parent and unknown fields', async () => {
    const errors = await validate(
      plainToInstance(AdminUpdateCategoryDto, { name_uz: 'x'.repeat(81), parent_id: 42, created_at: '2020-01-01' }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property).sort()).toEqual(['created_at', 'name_uz', 'parent_id']);
  });
});
