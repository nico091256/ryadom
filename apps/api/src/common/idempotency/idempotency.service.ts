import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { IDEMPOTENCY_KEY_TTL_SECONDS } from '@localshop/shared';
import { REDIS_CLIENT } from '../redis/redis.module';

const PROCESSING_SENTINEL = '__processing__';

/**
 * Redis-backed request deduplication for mutating endpoints that take an
 * `Idempotency-Key` header (e.g. order creation), so a double-tap or a retry
 * after a timeout doesn't create a duplicate side effect.
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private redisKey(scope: string, key: string): string {
    return `idempotency:${scope}:${key}`;
  }

  /**
   * Claims a key for the given scope. Returns `{ claimed: true }` if this is
   * the first time the key is seen (caller should proceed and call `store`
   * with the result). Returns `{ claimed: false, cached }` if a result was
   * already stored, or `{ claimed: false, cached: null }` if another request
   * with the same key is still being processed.
   */
  async claim(scope: string, key: string): Promise<{ claimed: boolean; cached: unknown | null }> {
    const redisKey = this.redisKey(scope, key);
    const didSet = await this.redis.set(redisKey, PROCESSING_SENTINEL, 'EX', IDEMPOTENCY_KEY_TTL_SECONDS, 'NX');
    if (didSet === 'OK') {
      return { claimed: true, cached: null };
    }

    const existing = await this.redis.get(redisKey);
    if (!existing || existing === PROCESSING_SENTINEL) {
      return { claimed: false, cached: null };
    }

    try {
      return { claimed: false, cached: JSON.parse(existing) };
    } catch {
      return { claimed: false, cached: null };
    }
  }

  /**
   * Stores the successful result for a claimed key so subsequent duplicate
   * requests get the same response instead of re-executing the operation.
   */
  async store(scope: string, key: string, result: unknown): Promise<void> {
    await this.redis.set(this.redisKey(scope, key), JSON.stringify(result), 'EX', IDEMPOTENCY_KEY_TTL_SECONDS);
  }

  /**
   * Releases a claimed key (e.g. because the operation failed), so a retry
   * with the same key can proceed instead of being treated as a duplicate.
   */
  async release(scope: string, key: string): Promise<void> {
    await this.redis.del(this.redisKey(scope, key));
  }
}
