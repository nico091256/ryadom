import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Records latency + status for every HTTP request. The `route` label is the
 * Express route template (`/api/v1/orders/:id`), never the concrete URL, so ids
 * do not explode label cardinality.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const route = MetricsInterceptor.routeTemplate(req);
    if (route === '/metrics' || route.endsWith('/metrics')) {
      return next.handle();
    }

    const method: string = req.method || 'UNKNOWN';
    const started = process.hrtime.bigint();
    const record = (statusCode: number) => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      this.metrics.observeHttpRequest(method, route, statusCode, seconds);
    };

    return next.handle().pipe(
      tap(() => record(res.statusCode || 200)),
      catchError((err) => {
        const status = typeof err?.getStatus === 'function' ? err.getStatus() : err?.status || 500;
        record(Number(status) || 500);
        return throwError(() => err);
      }),
    );
  }

  /** Route template with the global prefix; falls back to a constant so unmatched URLs share one label. */
  static routeTemplate(req: any): string {
    const path: string | undefined = req?.route?.path;
    if (!path) return 'unmatched';
    const base: string = req?.baseUrl || '';
    return `${base}${path}`;
  }
}
