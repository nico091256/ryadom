import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Every mutating admin action that is recorded in `audit_logs`. */
export type AuditAction =
  | 'shop.create'
  | 'shop.approve'
  | 'shop.block'
  | 'shop.unblock'
  | 'shop.reset_password'
  | 'shop.update'
  | 'order.cancel'
  | 'user.block'
  | 'user.unblock'
  | 'promo.create'
  | 'promo.update'
  | 'promo.delete'
  | 'category.create'
  | 'category.update'
  | 'category.delete'
  | 'product.update'
  | 'product.delete';

export type AuditTargetType = 'shop' | 'order' | 'user' | 'product' | 'category' | 'promo';

export interface AuditEntry {
  targetType: AuditTargetType;
  targetId?: string | null;
  /** Small, non-sensitive diff (reason, changed field names, before/after status). Never credentials. */
  meta?: Record<string, unknown>;
  ip?: string | null;
}

export interface AuditLogQuery {
  page?: string | number;
  limit?: string | number;
  actorId?: string;
  targetType?: string;
  action?: string;
}

const ACTOR_SELECT = { id: true, name: true, login: true } satisfies Prisma.UserSelect;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Records an admin action. Never throws: an audit write failure must not roll back
   * or fail the admin action itself, so errors are logged and swallowed.
   */
  async log(actorId: string, action: AuditAction, entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actor_id: actorId,
          action,
          target_type: entry.targetType,
          target_id: entry.targetId ?? null,
          meta: entry.meta === undefined ? undefined : (entry.meta as Prisma.InputJsonValue),
          ip: entry.ip ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `Audit log write failed for ${action} on ${entry.targetType}${entry.targetId ? `:${entry.targetId}` : ''} by ${actorId}: ${err?.message ?? err}`,
      );
    }
  }

  /** Paginated audit trail, newest first, with the acting admin attached. */
  async list(query: AuditLogQuery) {
    const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId?.trim()) where.actor_id = query.actorId.trim();
    if (query.targetType?.trim()) where.target_type = query.targetType.trim();
    if (query.action?.trim()) where.action = query.action.trim();

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: ACTOR_SELECT } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }
}
