import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListOrdersQueryDto } from './orders.dto';

const opts = { whitelist: true, forbidNonWhitelisted: true };

describe('ListOrdersQueryDto', () => {
  it('applies defaults and coerces page/limit strings to ints', async () => {
    const dto = plainToInstance(ListOrdersQueryDto, {});
    expect(await validate(dto, opts)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 20 });

    const paged = plainToInstance(ListOrdersQueryDto, { page: '3', limit: '50', status: 'on_the_way', paymentMethod: 'cash', shopId: 's1' });
    expect(await validate(paged, opts)).toHaveLength(0);
    expect(paged).toMatchObject({ page: 3, limit: 50, status: 'on_the_way', paymentMethod: 'cash', shopId: 's1' });
  });

  it.each([
    [{ status: 'DELIVERED' }, 'status'], // enum values are lowercase on the wire
    [{ status: 'shipped' }, 'status'],
    [{ paymentMethod: 'card' }, 'paymentMethod'],
    [{ page: '0' }, 'page'],
    [{ page: 'x' }, 'page'],
    [{ limit: '101' }, 'limit'],
    [{ limit: '2.5' }, 'limit'],
    [{ shopId: 'x'.repeat(65) }, 'shopId'],
    [{ date: '2026-01-01' }, 'date'], // unknown params are rejected, not silently dropped
  ])('rejects %j on %s', async (q, prop) => {
    const errors = await validate(plainToInstance(ListOrdersQueryDto, q), opts);
    expect(errors.map((e) => e.property)).toContain(prop);
  });
});
