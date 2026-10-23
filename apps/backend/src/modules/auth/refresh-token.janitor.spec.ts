import { RefreshTokenJanitor, REVOKED_TOKEN_RETENTION_MS } from './refresh-token.janitor';

describe('RefreshTokenJanitor', () => {
  let prisma: any;
  let janitor: RefreshTokenJanitor;

  beforeEach(() => {
    prisma = { refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) } };
    janitor = new RefreshTokenJanitor(prisma);
  });

  it('deletes rows that are expired OR were revoked more than 7 days ago', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');

    const deleted = await janitor.sweep(now);

    expect(deleted).toBe(3);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { expires_at: { lt: now } },
          { revoked_at: { lt: new Date(now.getTime() - REVOKED_TOKEN_RETENTION_MS) } },
        ],
      },
    });
    expect(REVOKED_TOKEN_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('never touches live (unexpired, unrevoked) rows: the where clause has no bare match', async () => {
    await janitor.sweep();
    const where = prisma.refreshToken.deleteMany.mock.calls[0][0].where;
    expect(Object.keys(where)).toEqual(['OR']);
    expect(where.OR).toHaveLength(2);
  });

  it('swallows database errors so the scheduler keeps ticking', async () => {
    prisma.refreshToken.deleteMany.mockRejectedValue(new Error('db down'));
    await expect(janitor.sweep()).resolves.toBe(0);
  });
});
