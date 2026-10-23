import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Get cached item by key or null if missing/failed
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis.status !== 'ready') return null;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err: any) {
      this.logger.debug(`Cache get error for key '${key}': ${err.message}`);
      return null;
    }
  }

  /**
   * Set cached item with TTL in seconds
   */
  async set(key: string, value: any, ttlSeconds = 60): Promise<void> {
    try {
      if (this.redis.status !== 'ready') return;
      const serialized = JSON.stringify(value);
      await this.redis.set(key, serialized, 'EX', ttlSeconds);
    } catch (err: any) {
      this.logger.debug(`Cache set error for key '${key}': ${err.message}`);
    }
  }

  /**
   * Delete cached key
   */
  async del(key: string): Promise<void> {
    try {
      if (this.redis.status !== 'ready') return;
      await this.redis.del(key);
    } catch (err: any) {
      this.logger.debug(`Cache del error for key '${key}': ${err.message}`);
    }
  }

  /**
   * Delete all keys matching a pattern (e.g. 'nearby:*' or 'shop:s1:*')
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.redis.status !== 'ready') return;
      // Plain awaited SCAN loop. The previous scanStream version attached an async
      // 'data' listener with no 'error' listener, so a failing DEL became an
      // unhandled rejection instead of a cache miss.
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: any) {
      this.logger.debug(`Cache delPattern error for '${pattern}': ${err.message}`);
    }
  }

  /**
   * Transparent cache wrapper: fetches from cache, or executes fallback and caches result.
   */
  async wrap<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 60): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
