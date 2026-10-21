import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('exposes the custom metric names in the Prometheus output', async () => {
    const output = await service.metrics();

    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('http_requests_total');
    expect(output).toContain('orders_created_total');
    // default metrics are collected into the same registry
    expect(output).toContain('process_cpu_user_seconds_total');
  });

  it('records a histogram observation and counter increment per request', async () => {
    service.observeHttpRequest('GET', '/api/v1/orders', 200, 0.042);
    service.observeHttpRequest('GET', '/api/v1/orders', 200, 0.3);

    const output = await service.metrics();

    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="/api/v1/orders",status_code="200"} 2',
    );
    // 0.042 falls into the 0.05 bucket; 0.3 only into >= 0.5
    expect(output).toContain(
      'http_request_duration_seconds_bucket{le="0.05",method="GET",route="/api/v1/orders",status_code="200"} 1',
    );
    expect(output).toContain(
      'http_request_duration_seconds_bucket{le="0.5",method="GET",route="/api/v1/orders",status_code="200"} 2',
    );
    expect(output).toContain('http_requests_total{method="GET",route="/api/v1/orders",status_code="200"} 2');
  });

  it('increments orders_created_total', async () => {
    service.ordersCreated.inc();
    service.ordersCreated.inc();

    expect(await service.metrics()).toContain('orders_created_total 2');
  });

  it('serves the prom-client content type', () => {
    expect(service.contentType).toContain('text/plain');
  });
});
