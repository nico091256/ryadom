import { Controller, Get, Headers, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { metricsTokenAccepted } from './metrics-token';
import { MetricsService } from './metrics.service';

/**
 * GET /api/v1/metrics — Prometheus scrape endpoint.
 * Public (no JWT) so Prometheus can scrape it; when METRICS_TOKEN is set the
 * scraper must send `Authorization: Bearer <METRICS_TOKEN>`.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  async getMetrics(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    if (!metricsTokenAccepted(authorization)) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid metrics token.' });
    }

    res.setHeader('Content-Type', this.metrics.contentType);
    res.send(await this.metrics.metrics());
  }
}
