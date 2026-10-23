import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { IDEMPOTENCY_KEY_TTL_SECONDS, IDEMPOTENCY_PROCESSING_TTL_SECONDS } from '@localshop/shared';
import { REDIS_CLIENT } from '../redis/redis.constants';

const PROCESSING_SENTINEL = '__processing__';

/** Stored shape for a completed request: the response plus the hash of the body that produced it. */
interface StoredResult {
  bodyHash: string;
  result: unknown;
}

export interface ClaimResult {
  /** True: first time this key is seen — caller proceeds and then calls `store`. */
  claimed: boolean;
  /** The previously stored response for a completed duplicate, else null. */
  cached: unknown | null;
  /** True when the same key was already used with a DIFFERENT request body (client bug). */
  bodyMismatch: boolean;
}

/**
 * Redis-backed request deduplication for mutating endpoints that take an
 * `Idempotency-Key` header (e.g. order creation), so a double-tap or a retry
 * after a timeout doesn't create a duplicate side effect.
 *
 * The key is bound to a hash of the request body: reusing a key with a
 * different body is reported as `bodyMismatch` (the controller answers 422)
 * instead of silently returning an unrelated cached response.
 *
 * Two TTLs: an in-flight claim lives only IDEMPOTENCY_PROCESSING_TTL_SECONDS
 * (so a crashed request does not block retries for a day), a stored response
 * lives IDEMPOTENCY_KEY_TTL_SECONDS.
 *
 * Degrades gracefully: when Redis is unreachable the request is treated as
 * first-seen (no dedupe) and a warning is logged — never a hang or a 500,
 * since the business operation itself does not depend on Redis.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Stable sha256 of a request body (JSON-serialised as received). */
  static hashBody(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
  }

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
   * already stored for the same body, `{ claimed: false, cached: null }` if
   * another request with the same key is still being processed, and
   * `bodyMismatch: true` if the key was previously used with a different body.
   */
  async claim(scope: string, key: string, bodyHash: string): Promise<ClaimResult> {
    if (!this.available) {
      this.logger.warn(`Redis not ready — Idempotency-Key for ${scope} not enforced.`);
      return { claimed: true, cached: null, bodyMismatch: false };
    }
    const redisKey = this.redisKey(scope, key);
    try {
      const didSet = await this.redis.set(
        redisKey,
        `${PROCESSING_SENTINEL}:${bodyHash}`,
        'EX',
        IDEMPOTENCY_PROCESSING_TTL_SECONDS,
        'NX',
      );
      if (didSet === 'OK') {
        return { claimed: true, cached: null, bodyMismatch: false };
      }

      const existing = await this.redis.get(redisKey);
      if (!existing) {
        // Expired between SET NX and GET; treat as in-flight so the client retries.
        return { claimed: false, cached: null, bodyMismatch: false };
      }

      if (existing.startsWith(PROCESSING_SENTINEL)) {
        const inFlightHash = existing.slice(PROCESSING_SENTINEL.length + 1);
        return { claimed: false, cached: null, bodyMismatch: inFlightHash !== '' && inFlightHash !== bodyHash };
      }

      try {
        const stored = JSON.parse(existing) as StoredResult;
        if (stored && typeof stored === 'object' && 'bodyHash' in stored) {
          if (stored.bodyHash !== bodyHash) {
            return { claimed: false, cached: null, bodyMismatch: true };
          }
          return { claimed: false, cached: stored.result, bodyMismatch: false };
        }
        // Legacy value written before body hashing: serve it as before.
        return { claimed: false, cached: stored, bodyMismatch: false };
      } catch {
        return { claimed: false, cached: null, bodyMismatch: false };
      }
    } catch (err: any) {
      this.logger.warn(`Redis error during idempotency claim (${err?.message ?? err}) — proceeding without dedupe.`);
      return { claimed: true, cached: null, bodyMismatch: false };
    }
  }

  /**
   * Stores the successful result for a claimed key so subsequent duplicate
   * requests (same body) get the same response instead of re-executing.
   */
  async store(scope: string, key: string, bodyHash: string, result: unknown): Promise<void> {
    if (!this.available) return;
    try {
      const payload: StoredResult = { bodyHash, result };
      await this.redis.set(this.redisKey(scope, key), JSON.stringify(payload), 'EX', IDEMPOTENCY_KEY_TTL_SECONDS);
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
