import { Controller, Get, Headers, Inject, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { Public } from './common/decorators/public.decorator';
import { metricsTokenAccepted } from './common/observability/metrics-token';
import { PrismaService } from './common/prisma/prisma.service';
import { REDIS_CLIENT } from './common/redis/redis.module';

@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness and readiness health check for load balancer and monitoring (status only)' })
  async getHealth() {
    const { status, timestamp } = await this.collect();
    // Anonymous callers learn nothing about the topology (Redis state, memory, uptime).
    return { status, timestamp };
  }

  @Public()
  @Get('details')
  @ApiOperation({
    summary: 'Detailed health (services, memory, uptime). Requires `Authorization: Bearer <METRICS_TOKEN>` when that variable is set.',
  })
  async getHealthDetails(@Headers('authorization') authorization: string | undefined) {
    if (!metricsTokenAccepted(authorization)) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid metrics token.' });
    }
    return this.collect();
  }

  private async collect() {
    let dbStatus = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      // If Postgres is not connected or in-memory fallback is active
      dbStatus = this.prisma.isPostgresConnected ? 'up' : 'in-memory-dev';
    }

    const redisStatus = this.redis.status === 'ready' ? 'up' : 'degraded-offline';
    const memory = process.memoryUsage();

    return {
      // Only a reachable Postgres is "ok": the in-memory dev store must never look healthy to a load balancer.
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      memory: {
        rssMb: Math.round(memory.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
      },
    };
  }
}
