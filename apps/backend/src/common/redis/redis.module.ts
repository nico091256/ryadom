import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis');
        const client = new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null,
          // Fail fast while disconnected instead of queueing commands forever —
          // callers (idempotency) degrade gracefully, requests never hang.
          enableOfflineQueue: false,
          // Back off reconnect attempts (0.5s → 10s) so a missing Redis in local
          // dev doesn't flood the log every few milliseconds.
          retryStrategy: (times) => Math.min(times * 500, 10_000),
        });
        let warned = false;
        client.on('error', (err: Error) => {
          if (!warned) {
            warned = true;
            logger.warn(`Redis unavailable (${err.message}); idempotency dedupe is disabled until it reconnects.`);
          }
        });
        client.on('ready', () => {
          warned = false;
          logger.log('Redis connected.');
        });
        return client;
      },
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule {}
