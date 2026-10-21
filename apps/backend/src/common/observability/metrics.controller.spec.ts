import { UnauthorizedException } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  const originalToken = process.env.METRICS_TOKEN;
  let controller: MetricsController;
  let res: { setHeader: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    controller = new MetricsController(new MetricsService());
    res = { setHeader: jest.fn(), send: jest.fn() };
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = originalToken;
  });

  it('returns metrics without auth when METRICS_TOKEN is not set', async () => {
    delete process.env.METRICS_TOKEN;

    await controller.getMetrics(undefined, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/plain'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('http_requests_total'));
  });

  it('rejects with 401 when METRICS_TOKEN is set and no bearer token is sent', async () => {
    process.env.METRICS_TOKEN = 'secret-scrape-token';

    await expect(controller.getMetrics(undefined, res as any)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.getMetrics('Bearer wrong', res as any)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(res.send).not.toHaveBeenCalled();
  });

  it('accepts the matching bearer token', async () => {
    process.env.METRICS_TOKEN = 'secret-scrape-token';

    await controller.getMetrics('Bearer secret-scrape-token', res as any);

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('http_request_duration_seconds'));
  });
});
