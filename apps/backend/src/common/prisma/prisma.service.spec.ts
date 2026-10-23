import { PrismaService } from './prisma.service';

describe('PrismaService.inMemoryFallbackAllowed', () => {
  it('allows the seeded in-memory store only for local development and tests', () => {
    expect(PrismaService.inMemoryFallbackAllowed(undefined)).toBe(true);
    expect(PrismaService.inMemoryFallbackAllowed('')).toBe(true);
    expect(PrismaService.inMemoryFallbackAllowed('development')).toBe(true);
    expect(PrismaService.inMemoryFallbackAllowed('test')).toBe(true);
  });

  it('refuses it for production and any other deployment environment', () => {
    expect(PrismaService.inMemoryFallbackAllowed('production')).toBe(false);
    expect(PrismaService.inMemoryFallbackAllowed('staging')).toBe(false);
    expect(PrismaService.inMemoryFallbackAllowed('prod')).toBe(false);
  });
});

describe('PrismaService in-memory $transaction', () => {
  let service: PrismaService;

  beforeAll(async () => {
    // PrismaClient connects lazily, so constructing it without Postgres is fine;
    // we never call onModuleInit and wire the memory store by hand instead.
    service = new PrismaService();
    await (service as any).initInMemoryStore();
    (service as any).wrapModelsWithMemoryFallback();
  });

  it('rolls the whole store back when the callback throws (no partial stock decrement)', async () => {
    const before = await service.product.findUnique({ where: { id: 'p-1' } });
    expect(before?.stock).toBe(45);

    await expect(
      service.$transaction(async (tx) => {
        await tx.product.update({ where: { id: 'p-1' }, data: { stock: { decrement: 5 } } });
        await tx.orderStatusHistory.create({ data: { order_id: 'o-demo-1', status: 'cancelled' as any, changed_by: null, reason: 'x' } });
        throw new Error('second item out of stock');
      }),
    ).rejects.toThrow('second item out of stock');

    const after = await service.product.findUnique({ where: { id: 'p-1' } });
    expect(after?.stock).toBe(45);
    expect(await service.orderStatusHistory.count({ where: { order_id: 'o-demo-1' } })).toBe(1);
    // Dates survive the snapshot/restore round-trip as Date instances.
    expect(after?.created_at).toBeInstanceOf(Date);
  });

  it('keeps the writes when the callback succeeds', async () => {
    await service.$transaction(async (tx) => {
      await tx.product.update({ where: { id: 'p-1' }, data: { stock: { decrement: 5 } } });
    });
    const after = await service.product.findUnique({ where: { id: 'p-1' } });
    expect(after?.stock).toBe(40);
  });

  it('supports findUniqueOrThrow', async () => {
    await expect(service.product.findUniqueOrThrow({ where: { id: 'p-1' } })).resolves.toMatchObject({ id: 'p-1' });
    await expect(service.product.findUniqueOrThrow({ where: { id: 'nope' } })).rejects.toThrow();
  });
});
