import { IDEMPOTENCY_KEY_TTL_SECONDS, IDEMPOTENCY_PROCESSING_TTL_SECONDS } from '@localshop/shared';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let redis: any;
  let service: IdempotencyService;
  const bodyA = IdempotencyService.hashBody({ address_text: 'A', lat: 1, lng: 1 });
  const bodyB = IdempotencyService.hashBody({ address_text: 'B', lat: 1, lng: 1 });

  beforeEach(() => {
    const store = new Map<string, string>();
    redis = {
      status: 'ready',
      set: jest.fn((key: string, value: string, _ex: string, _ttl: number, nx?: string) => {
        if (nx === 'NX' && store.has(key)) return Promise.resolve(null);
        store.set(key, value);
        return Promise.resolve('OK');
      }),
      get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      del: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve(1);
      }),
    };
    service = new IdempotencyService(redis);
  });

  it('hashBody is stable for equal bodies and differs for different ones', () => {
    expect(IdempotencyService.hashBody({ a: 1, b: 'x' })).toBe(IdempotencyService.hashBody({ a: 1, b: 'x' }));
    expect(bodyA).not.toBe(bodyB);
    expect(bodyA).toMatch(/^[0-9a-f]{64}$/);
  });

  it('claims a fresh key for the first request with a short in-flight TTL', async () => {
    const result = await service.claim('orders:create:u1', 'key-1', bodyA);
    expect(result).toEqual({ claimed: true, cached: null, bodyMismatch: false });
    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:orders:create:u1:key-1',
      expect.stringContaining('__processing__'),
      'EX',
      IDEMPOTENCY_PROCESSING_TTL_SECONDS,
      'NX',
    );
    expect(IDEMPOTENCY_PROCESSING_TTL_SECONDS).toBeLessThan(IDEMPOTENCY_KEY_TTL_SECONDS);
  });

  it('returns cached:null (in-progress) for a concurrent duplicate before the result is stored', async () => {
    await service.claim('orders:create:u1', 'key-1', bodyA);
    const result = await service.claim('orders:create:u1', 'key-1', bodyA);
    expect(result).toEqual({ claimed: false, cached: null, bodyMismatch: false });
  });

  it('returns the stored result for a retried duplicate after completion, kept for the long TTL', async () => {
    await service.claim('orders:create:u1', 'key-1', bodyA);
    await service.store('orders:create:u1', 'key-1', bodyA, { id: 'order-1', status: 'new' });
    expect(redis.set).toHaveBeenLastCalledWith(
      'idempotency:orders:create:u1:key-1',
      expect.any(String),
      'EX',
      IDEMPOTENCY_KEY_TTL_SECONDS,
    );

    const result = await service.claim('orders:create:u1', 'key-1', bodyA);
    expect(result).toEqual({ claimed: false, cached: { id: 'order-1', status: 'new' }, bodyMismatch: false });
  });

  it('flags a completed key reused with a different body instead of serving the unrelated response', async () => {
    await service.claim('orders:create:u1', 'key-1', bodyA);
    await service.store('orders:create:u1', 'key-1', bodyA, { id: 'order-1' });

    const result = await service.claim('orders:create:u1', 'key-1', bodyB);
    expect(result).toEqual({ claimed: false, cached: null, bodyMismatch: true });
  });

  it('flags an in-flight key reused with a different body', async () => {
    await service.claim('orders:create:u1', 'key-1', bodyA);
    const result = await service.claim('orders:create:u1', 'key-1', bodyB);
    expect(result).toEqual({ claimed: false, cached: null, bodyMismatch: true });
  });

  it('still serves legacy cached values written without a body hash', async () => {
    await redis.set('idempotency:orders:create:u1:old', JSON.stringify({ id: 'order-old' }), 'EX', 1);
    const result = await service.claim('orders:create:u1', 'old', bodyA);
    expect(result).toEqual({ claimed: false, cached: { id: 'order-old' }, bodyMismatch: false });
  });

  it('lets a retry proceed again after release (e.g. the operation failed)', async () => {
    await service.claim('orders:create:u1', 'key-1', bodyA);
    await service.release('orders:create:u1', 'key-1');

    const result = await service.claim('orders:create:u1', 'key-1', bodyA);
    expect(result).toEqual({ claimed: true, cached: null, bodyMismatch: false });
  });

  it('scopes keys independently so two different customers can reuse the same key value', async () => {
    const a = await service.claim('orders:create:u1', 'same-key', bodyA);
    const b = await service.claim('orders:create:u2', 'same-key', bodyA);
    expect(a.claimed).toBe(true);
    expect(b.claimed).toBe(true);
  });

  it('degrades to "no dedupe" instead of failing or hanging when Redis is not connected', async () => {
    redis.status = 'reconnecting';
    const result = await service.claim('orders:create:u1', 'key-1', bodyA);
    expect(result).toEqual({ claimed: true, cached: null, bodyMismatch: false });
    expect(redis.set).not.toHaveBeenCalled();
    await expect(service.store('orders:create:u1', 'key-1', bodyA, { id: 'o' })).resolves.toBeUndefined();
    await expect(service.release('orders:create:u1', 'key-1')).resolves.toBeUndefined();
  });

  it('degrades to "no dedupe" when a Redis command throws', async () => {
    redis.set.mockRejectedValueOnce(new Error("Stream isn't writeable"));
    const result = await service.claim('orders:create:u1', 'key-1', bodyA);
    expect(result).toEqual({ claimed: true, cached: null, bodyMismatch: false });
  });
});
