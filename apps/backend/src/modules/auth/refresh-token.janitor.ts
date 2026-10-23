import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Revoked rows are kept for a while so refresh-token reuse can still be detected. */
export const REVOKED_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hourly sweep of the `refresh_tokens` table: expired rows and rows revoked
 * more than 7 days ago are useless (refreshToken() refuses both) and would
 * otherwise accumulate forever - one row per login / rotation.
 */
@Injectable()
export class RefreshTokenJanitor {
  private readonly logger = new Logger(RefreshTokenJanitor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(now: Date = new Date()): Promise<number> {
    try {
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expires_at: { lt: now } },
            { revoked_at: { lt: new Date(now.getTime() - REVOKED_TOKEN_RETENTION_MS) } },
          ],
        },
      });
      if (count > 0) this.logger.log(`Deleted ${count} expired/revoked refresh tokens`);
      return count;
    } catch (err: any) {
      // A failed sweep is not fatal; the next tick retries.
      this.logger.warn(`Refresh-token sweep failed: ${err?.message ?? err}`);
      return 0;
    }
  }
}
