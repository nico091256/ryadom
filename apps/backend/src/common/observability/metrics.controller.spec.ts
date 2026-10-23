import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { MetricsController } from './metrics.controller';
import { metricsTokenAccepted } from './metrics-token';
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

  it('rejects a token of a different length and a same-length near miss (constant-time compare)', async () => {
    process.env.METRICS_TOKEN = 'secret-scrape-token';

    await expect(controller.getMetrics('Bearer secret-scrape-toke', res as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.getMetrics('Bearer secret-scrape-tokeX', res as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.getMetrics('secret-scrape-token', res as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(res.send).not.toHaveBeenCalled();
  });
});

describe('metricsTokenAccepted', () => {
  const originalToken = process.env.METRICS_TOKEN;
  afterEach(() => {
    if (originalToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = originalToken;
  });

  it('is open when METRICS_TOKEN is empty or unset', () => {
    delete process.env.METRICS_TOKEN;
    expect(metricsTokenAccepted(undefined)).toBe(true);
    process.env.METRICS_TOKEN = '';
    expect(metricsTokenAccepted('Bearer whatever')).toBe(true);
  });

  it('uses timingSafeEqual on equal-length buffers only', () => {
    process.env.METRICS_TOKEN = 'abc';
    const spy = jest.spyOn(crypto, 'timingSafeEqual');

    expect(metricsTokenAccepted('Bearer abcd')).toBe(false);
    expect(spy).not.toHaveBeenCalled(); // length mismatch never reaches timingSafeEqual (it would throw)

    expect(metricsTokenAccepted('bearer abc')).toBe(true); // scheme is case-insensitive
    expect(metricsTokenAccepted('Bearer abd')).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
