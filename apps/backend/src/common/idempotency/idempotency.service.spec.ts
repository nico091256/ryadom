import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let redis: any;
  let service: IdempotencyService;

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

  it('claims a fresh key for the first request', async () => {
    const result = await service.claim('orders:create:u1', 'key-1');
    expect(result).toEqual({ claimed: true, cached: null });
  });

  it('returns cached:null (in-progress) for a concurrent duplicate before the result is stored', async () => {
    await service.claim('orders:create:u1', 'key-1');
    const result = await service.claim('orders:create:u1', 'key-1');
    expect(result).toEqual({ claimed: false, cached: null });
  });

  it('returns the stored result for a retried duplicate after completion', async () => {
    await service.claim('orders:create:u1', 'key-1');
    await service.store('orders:create:u1', 'key-1', { id: 'order-1', status: 'new' });

    const result = await service.claim('orders:create:u1', 'key-1');
    expect(result).toEqual({ claimed: false, cached: { id: 'order-1', status: 'new' } });
  });

  it('lets a retry proceed again after release (e.g. the operation failed)', async () => {
    await service.claim('orders:create:u1', 'key-1');
    await service.release('orders:create:u1', 'key-1');

    const result = await service.claim('orders:create:u1', 'key-1');
    expect(result).toEqual({ claimed: true, cached: null });
  });

  it('scopes keys independently so two different customers can reuse the same key value', async () => {
    const a = await service.claim('orders:create:u1', 'same-key');
    const b = await service.claim('orders:create:u2', 'same-key');
    expect(a.claimed).toBe(true);
    expect(b.claimed).toBe(true);
  });

  it('degrades to "no dedupe" instead of failing or hanging when Redis is not connected', async () => {
    redis.status = 'reconnecting';
    const result = await service.claim('orders:create:u1', 'key-1');
    expect(result).toEqual({ claimed: true, cached: null });
    expect(redis.set).not.toHaveBeenCalled();
    await expect(service.store('orders:create:u1', 'key-1', { id: 'o' })).resolves.toBeUndefined();
    await expect(service.release('orders:create:u1', 'key-1')).resolves.toBeUndefined();
  });

  it('degrades to "no dedupe" when a Redis command throws', async () => {
    redis.set.mockRejectedValueOnce(new Error("Stream isn't writeable"));
    const result = await service.claim('orders:create:u1', 'key-1');
    expect(result).toEqual({ claimed: true, cached: null });
  });
});
