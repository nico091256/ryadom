import { NotFoundException } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

function httpContext(req: any, res: any) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as any;
}

describe('MetricsInterceptor', () => {
  let metrics: MetricsService;
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    metrics = new MetricsService();
    interceptor = new MetricsInterceptor(metrics);
  });

  it('labels by route template, not by the concrete URL', async () => {
    const req = { method: 'GET', baseUrl: '/api/v1', route: { path: '/orders/:id' }, url: '/api/v1/orders/abc-123' };
    const ctx = httpContext(req, { statusCode: 200 });

    await lastValueFrom(interceptor.intercept(ctx, { handle: () => of({ id: 'abc-123' }) }));

    const output = await metrics.metrics();
    expect(output).toContain('http_requests_total{method="GET",route="/api/v1/orders/:id",status_code="200"} 1');
    expect(output).not.toContain('abc-123');
  });

  it('records the HttpException status on errors and rethrows', async () => {
    const req = { method: 'GET', baseUrl: '/api/v1', route: { path: '/orders/:id' } };
    const ctx = httpContext(req, { statusCode: 200 });

    await expect(
      lastValueFrom(interceptor.intercept(ctx, { handle: () => throwError(() => new NotFoundException()) })),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(await metrics.metrics()).toContain(
      'http_requests_total{method="GET",route="/api/v1/orders/:id",status_code="404"} 1',
    );
  });

  it('does not record the /metrics scrape itself', async () => {
    const req = { method: 'GET', baseUrl: '/api/v1', route: { path: '/metrics' } };
    await lastValueFrom(interceptor.intercept(httpContext(req, { statusCode: 200 }), { handle: () => of('') }));

    expect(await metrics.metrics()).not.toContain('route="/api/v1/metrics"');
  });
});
