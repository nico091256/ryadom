import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PosApiKeyGuard } from './pos-api-key.guard';

function contextFor(headers: Record<string, string>) {
  const req: any = { headers };
  return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any };
}

describe('PosApiKeyGuard', () => {
  let prisma: any;
  let guard: PosApiKeyGuard;

  beforeEach(() => {
    prisma = { shop: { findUnique: jest.fn() } };
    guard = new PosApiKeyGuard(prisma);
  });

  it('reads the key from X-API-Key or from "Authorization: ApiKey <key>"', () => {
    expect(PosApiKeyGuard.readKey({ 'x-api-key': ' rk_pos_a ' })).toBe('rk_pos_a');
    expect(PosApiKeyGuard.readKey({ authorization: 'ApiKey rk_pos_b' })).toBe('rk_pos_b');
    expect(PosApiKeyGuard.readKey({ authorization: 'Bearer jwt' })).toBe('');
    expect(PosApiKeyGuard.readKey({})).toBe('');
  });

  it('rejects a request without a key', async () => {
    const { ctx } = contextFor({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.shop.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unknown key', async () => {
    prisma.shop.findUnique.mockResolvedValue(null);
    const { ctx } = contextFor({ 'x-api-key': 'rk_pos_unknown' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.shop.findUnique).toHaveBeenCalledWith({ where: { pos_api_key: 'rk_pos_unknown' } });
  });

  it('rejects a blocked or inactive shop', async () => {
    prisma.shop.findUnique.mockResolvedValue({ id: 's-1', is_active: true, status: 'blocked' });
    const { ctx } = contextFor({ 'x-api-key': 'rk_pos_x' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches the shop to the request on success', async () => {
    const shop = { id: 's-1', owner_id: 'u-1', is_active: true, status: 'active' };
    prisma.shop.findUnique.mockResolvedValue(shop);
    const { ctx, req } = contextFor({ 'x-api-key': 'rk_pos_x' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.posShop).toBe(shop);
  });
});
