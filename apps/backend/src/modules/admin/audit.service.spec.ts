import { Logger } from '@nestjs/common';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let prisma: any;
  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'al-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new AuditService(prisma);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('log', () => {
    it('writes actor, action, target, meta and ip', async () => {
      await service.log('admin-1', 'shop.block', {
        targetType: 'shop',
        targetId: 's-1',
        meta: { from: 'active', to: 'blocked' },
        ip: '10.0.0.7',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actor_id: 'admin-1',
          action: 'shop.block',
          target_type: 'shop',
          target_id: 's-1',
          meta: { from: 'active', to: 'blocked' },
          ip: '10.0.0.7',
        },
      });
    });

    it('defaults optional fields to null / undefined', async () => {
      await service.log('admin-1', 'promo.create', { targetType: 'promo' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ target_id: null, ip: null, meta: undefined }),
      });
    });

    it('never throws when the write fails (logs a warning instead)', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.log('admin-1', 'order.cancel', { targetType: 'order', targetId: 'o-1', meta: { reason: 'x' } }),
      ).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('order.cancel');
      expect(warn.mock.calls[0][0]).toContain('db down');
    });
  });

  describe('list', () => {
    it('paginates newest first, includes the actor and applies filters', async () => {
      const rows = [{ id: 'al-2', action: 'shop.block', actor: { id: 'admin-1', name: 'A', login: 'admin' } }];
      prisma.auditLog.findMany.mockResolvedValue(rows);
      prisma.auditLog.count.mockResolvedValue(45);

      const result = await service.list({ page: '2', limit: '20', actorId: 'admin-1', targetType: 'shop', action: 'shop.block' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { actor_id: 'admin-1', target_type: 'shop', action: 'shop.block' },
        include: { actor: { select: { id: true, name: true, login: true } } },
        orderBy: { created_at: 'desc' },
        skip: 20,
        take: 20,
      });
      expect(result).toEqual({ data: rows, total: 45, page: 2, limit: 20, totalPages: 3 });
    });

    it('clamps limit to 1..100 and page to >= 1', async () => {
      await service.list({ page: '0', limit: '500' });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 100 }));
    });
  });
});
