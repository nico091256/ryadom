import { CacheService } from './cache.service';

describe('CacheService.delPattern', () => {
  let redis: any;
  let service: CacheService;

  beforeEach(() => {
    redis = {
      status: 'ready',
      scan: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      get: jest.fn(),
      set: jest.fn(),
    };
    service = new CacheService(redis);
  });

  it('walks the SCAN cursor to the end and deletes every batch', async () => {
    redis.scan
      .mockResolvedValueOnce(['17', ['nearby:a', 'nearby:b']])
      .mockResolvedValueOnce(['0', ['nearby:c']]);

    await service.delPattern('nearby:*');

    expect(redis.scan).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'nearby:*', 'COUNT', 100);
    expect(redis.scan).toHaveBeenNthCalledWith(2, '17', 'MATCH', 'nearby:*', 'COUNT', 100);
    expect(redis.del).toHaveBeenCalledTimes(2);
    expect(redis.del).toHaveBeenNthCalledWith(1, 'nearby:a', 'nearby:b');
    expect(redis.del).toHaveBeenNthCalledWith(2, 'nearby:c');
  });

  it('skips DEL for empty SCAN pages', async () => {
    redis.scan.mockResolvedValueOnce(['0', []]);
    await service.delPattern('nearby:*');
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('does nothing when Redis is not ready', async () => {
    redis.status = 'reconnecting';
    await service.delPattern('nearby:*');
    expect(redis.scan).not.toHaveBeenCalled();
  });

  it('swallows Redis errors instead of rejecting', async () => {
    redis.scan.mockRejectedValue(new Error('READONLY'));
    await expect(service.delPattern('nearby:*')).resolves.toBeUndefined();

    redis.scan.mockResolvedValueOnce(['0', ['k']]);
    redis.del.mockRejectedValue(new Error('boom'));
    await expect(service.delPattern('nearby:*')).resolves.toBeUndefined();
  });

  it('wrap() serves the cached value and only calls the fetcher on a miss', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify({ hit: true }));
    const fetcher = jest.fn().mockResolvedValue({ hit: false });

    expect(await service.wrap('k', fetcher, 30)).toEqual({ hit: true });
    expect(fetcher).not.toHaveBeenCalled();

    redis.get.mockResolvedValueOnce(null);
    expect(await service.wrap('k', fetcher, 30)).toEqual({ hit: false });
    expect(redis.set).toHaveBeenCalledWith('k', JSON.stringify({ hit: false }), 'EX', 30);
  });
});
