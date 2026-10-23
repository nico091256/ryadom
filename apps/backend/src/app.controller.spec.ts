import { UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';

describe('AppController /health', () => {
  const originalToken = process.env.METRICS_TOKEN;
  let prisma: any;
  let redis: any;
  let controller: AppController;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]), isPostgresConnected: true };
    redis = { status: 'ready' };
    controller = new AppController(prisma, redis);
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = originalToken;
  });

  it('GET /health exposes only status + timestamp', async () => {
    const body = await controller.getHealth();
    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });

  it('GET /health reports degraded when Postgres is unreachable (in-memory fallback is never ok)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));
    prisma.isPostgresConnected = false;
    const body = await controller.getHealth();
    expect(body.status).toBe('degraded');
  });

  it('GET /health/details returns the full body when METRICS_TOKEN is unset', async () => {
    delete process.env.METRICS_TOKEN;
    const body = await controller.getHealthDetails(undefined);
    expect(body.services).toEqual({ database: 'up', redis: 'up' });
    expect(body.memory.rssMb).toBeGreaterThan(0);
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('GET /health/details requires the bearer token when METRICS_TOKEN is set', async () => {
    process.env.METRICS_TOKEN = 'ops-token';
    await expect(controller.getHealthDetails(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.getHealthDetails('Bearer nope')).rejects.toBeInstanceOf(UnauthorizedException);

    const body = await controller.getHealthDetails('Bearer ops-token');
    expect(body.services.database).toBe('up');
  });
});
