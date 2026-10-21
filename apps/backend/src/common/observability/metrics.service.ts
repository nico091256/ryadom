import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics registry for the API. One instance per process; the
 * interceptor feeds the HTTP metrics, business counters are exposed for the
 * domain services (e.g. `ordersCreated.inc()` after a successful createOrder).
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestDuration: Histogram<'method' | 'route' | 'status_code'>;
  readonly httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;
  readonly ordersCreated: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds, labelled by route template (not raw URL).',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests handled.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.ordersCreated = new Counter({
      name: 'orders_created_total',
      help: 'Orders successfully created (increment from OrdersService.createOrder).',
      registers: [this.registry],
    });
  }

  /** Records one finished HTTP request. */
  observeHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestDuration.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
  }

  /** Prometheus text exposition of every metric in the registry. */
  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
