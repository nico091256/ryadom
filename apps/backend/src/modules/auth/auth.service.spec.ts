import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService, SMS_MAX_PER_PHONE_PER_HOUR } from './auth.service';

const TEST_JWT_SECRET = 'unit-test-access-secret-minimum-32-characters-long';

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
      smsCode: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };
    // The JWT secret is guaranteed by env validation at boot; mirror that here.
    configService = {
      get: jest.fn((key: string, def?: any) => (key === 'JWT_ACCESS_SECRET' ? TEST_JWT_SECRET : def)),
    };
    smsService = { sendSms: jest.fn() };
    service = new AuthService(prisma, jwtService, configService, smsService);
  });

  describe('sendCode', () => {
    const phone = '+998901234567';

    it('sends a code and prunes only rows older than the rolling hour (count happens before cleanup)', async () => {
      prisma.smsCode.count.mockResolvedValue(SMS_MAX_PER_PHONE_PER_HOUR - 1);

      const result = await service.sendCode({ phone });

      expect(result.success).toBe(true);
      expect(smsService.sendSms).toHaveBeenCalledWith(phone, expect.stringContaining('123456'));
      expect(prisma.smsCode.count).toHaveBeenCalledWith({
        where: { phone, created_at: { gte: expect.any(Date) } },
      });
      // Only expired-window rows are deleted, never the whole phone history.
      expect(prisma.smsCode.deleteMany).toHaveBeenCalledWith({
        where: { phone, created_at: { lt: expect.any(Date) } },
      });
      const countOrder = prisma.smsCode.count.mock.invocationCallOrder[0];
      const deleteOrder = prisma.smsCode.deleteMany.mock.invocationCallOrder[0];
      expect(countOrder).toBeLessThan(deleteOrder);
      expect(prisma.smsCode.create).toHaveBeenCalledTimes(1);
    });

    it('rejects with 429 SMS_HOURLY_LIMIT once 5 codes were issued to the phone within an hour', async () => {
      prisma.smsCode.count.mockResolvedValue(SMS_MAX_PER_PHONE_PER_HOUR);

      let caught: unknown;
      try {
        await service.sendCode({ phone });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(HttpException);
      expect((caught as HttpException).getStatus()).toBe(429);
      expect((caught as HttpException).getResponse()).toEqual(
        expect.objectContaining({ code: 'SMS_HOURLY_LIMIT' }),
      );
      expect(prisma.smsCode.deleteMany).not.toHaveBeenCalled();
      expect(prisma.smsCode.create).not.toHaveBeenCalled();
      expect(smsService.sendSms).not.toHaveBeenCalled();
    });

    it('keeps the 30 second cooldown (400 RATE_LIMIT_EXCEEDED) ahead of the hourly check', async () => {
      prisma.smsCode.findFirst.mockResolvedValue({ id: 'c1', phone, created_at: new Date() });

      await expect(service.sendCode({ phone })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.smsCode.count).not.toHaveBeenCalled();
    });
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
