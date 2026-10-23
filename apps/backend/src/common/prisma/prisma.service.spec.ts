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
