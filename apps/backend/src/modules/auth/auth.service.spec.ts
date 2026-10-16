import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let smsService: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };
    configService = { get: jest.fn((_key: string, def?: any) => def) };
    smsService = { sendSms: jest.fn() };
    service = new AuthService(prisma, jwtService, configService, smsService);
  });

  describe('login', () => {
    it('rejects the former hardcoded demo-password backdoor for seller_chilonzor', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        login: 'seller_chilonzor',
        password_hash: await bcrypt.hash('TheActualRealPassword!', 10),
        is_blocked: false,
        role: 'seller',
        shops: [],
      });

      await expect(
        service.login({ login: 'seller_chilonzor', password: 'Shopkeeper123!' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        service.login({ login: 'seller_chilonzor', password: 'Seller123456!' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts the real password and persists a hashed refresh token', async () => {
      const realPassword = 'TheActualRealPassword!';
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        login: 'seller_chilonzor',
        password_hash: await bcrypt.hash(realPassword, 10),
        is_blocked: false,
        role: 'seller',
        shops: [],
      });

      const result = await service.login({ login: 'seller_chilonzor', password: realPassword } as any);

      expect(result.accessToken).toBe('signed-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ user_id: 'u1' }) }),
      );
      // The raw refresh token is never stored verbatim, only its hash.
      const storedHash = prisma.refreshToken.create.mock.calls[0][0].data.token_hash;
      expect(storedHash).not.toBe(result.refreshToken);
    });
  });

  describe('refreshToken', () => {
    it('rotates: revokes the old DB row and issues a new refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        user_id: 'u1',
        revoked_at: null,
        expires_at: new Date(Date.now() + 1000 * 60 * 60),
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'customer', is_blocked: false, phone: '+998900000000' });

      const result = await service.refreshToken('some-raw-refresh-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt1' },
        data: { revoked_at: expect.any(Date) },
      });
      expect(result.accessToken).toBe('signed-access-token');
    });

    it('rejects an unknown, revoked, or expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refreshToken('bogus')).rejects.toBeInstanceOf(UnauthorizedException);

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        user_id: 'u1',
        revoked_at: new Date(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60),
      });
      await expect(service.refreshToken('revoked')).rejects.toBeInstanceOf(UnauthorizedException);

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        user_id: 'u1',
        revoked_at: null,
        expires_at: new Date(Date.now() - 1000),
      });
      await expect(service.refreshToken('expired')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes only the matching, not-yet-revoked refresh token', async () => {
      await service.logout('some-raw-refresh-token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token_hash: expect.any(String), revoked_at: null },
        data: { revoked_at: expect.any(Date) },
      });
    });
  });
});
