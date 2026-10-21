import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { IDEMPOTENCY_KEY_TTL_SECONDS } from '@localshop/shared';
import { REDIS_CLIENT } from '../redis/redis.constants';

const PROCESSING_SENTINEL = '__processing__';

/**
 * Redis-backed request deduplication for mutating endpoints that take an
 * `Idempotency-Key` header (e.g. order creation), so a double-tap or a retry
 * after a timeout doesn't create a duplicate side effect.
 *
 * Degrades gracefully: when Redis is unreachable the request is treated as
 * first-seen (no dedupe) and a warning is logged — never a hang or a 500,
 * since the business operation itself does not depend on Redis.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private redisKey(scope: string, key: string): string {
    return `idempotency:${scope}:${key}`;
  }

  private get available(): boolean {
    return this.redis.status === 'ready';
  }

  /**
   * Claims a key for the given scope. Returns `{ claimed: true }` if this is
   * the first time the key is seen (caller should proceed and call `store`
   * with the result). Returns `{ claimed: false, cached }` if a result was
   * already stored, or `{ claimed: false, cached: null }` if another request
   * with the same key is still being processed.
   */
  async claim(scope: string, key: string): Promise<{ claimed: boolean; cached: unknown | null }> {
    if (!this.available) {
      this.logger.warn(`Redis not ready — Idempotency-Key for ${scope} not enforced.`);
      return { claimed: true, cached: null };
    }
    const redisKey = this.redisKey(scope, key);
    try {
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
    } catch (err: any) {
      this.logger.warn(`Redis error during idempotency claim (${err?.message ?? err}) — proceeding without dedupe.`);
      return { claimed: true, cached: null };
    }
  }

  /**
   * Stores the successful result for a claimed key so subsequent duplicate
   * requests get the same response instead of re-executing the operation.
   */
  async store(scope: string, key: string, result: unknown): Promise<void> {
    if (!this.available) return;
    try {
      await this.redis.set(this.redisKey(scope, key), JSON.stringify(result), 'EX', IDEMPOTENCY_KEY_TTL_SECONDS);
    } catch (err: any) {
      this.logger.warn(`Redis error storing idempotency result (${err?.message ?? err}).`);
    }
  }

  /**
   * Releases a claimed key (e.g. because the operation failed), so a retry
   * with the same key can proceed instead of being treated as a duplicate.
   */
  async release(scope: string, key: string): Promise<void> {
    if (!this.available) return;
    try {
      await this.redis.del(this.redisKey(scope, key));
    } catch (err: any) {
      this.logger.warn(`Redis error releasing idempotency key (${err?.message ?? err}).`);
    }
  }
}
