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
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      smsCode: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      // Prisma's array form: the operations are already-built promises, resolve them all.
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-access-token'),
      // iat/exp of the signed token: 10 minutes (JWT_ACCESS_EXPIRATION may differ from 15m).
      decode: jest.fn().mockReturnValue({ sub: 'u1', role: 'seller', iat: 1_700_000_000, exp: 1_700_000_600 }),
    };
    // The JWT secret is guaranteed by env validation at boot; mirror that here.
    configService = {
      get: jest.fn((key: string, def?: any) => (key === 'JWT_ACCESS_SECRET' ? TEST_JWT_SECRET : def)),
    };
    smsService = { sendSms: jest.fn().mockResolvedValue(true) };
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

    it('answers 503 SMS_DELIVERY_FAILED instead of a fake success when the gateway refuses the message', async () => {
      smsService.sendSms.mockResolvedValue(false);

      let caught: unknown;
      try {
        await service.sendCode({ phone });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(HttpException);
      expect((caught as HttpException).getStatus()).toBe(503);
      expect((caught as HttpException).getResponse()).toEqual(expect.objectContaining({ code: 'SMS_DELIVERY_FAILED' }));
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

    it('signs a minimal HS256 payload ({ sub, role }, no login/phone) and reports the real expiry', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        login: 'seller_chilonzor',
        phone: '+998901234567',
        password_hash: await bcrypt.hash('pw-123456!', 4),
        is_blocked: false,
        role: 'seller',
        shops: [],
      });

      const result = await service.login({ login: 'seller_chilonzor', password: 'pw-123456!' } as any);

      const [payload, options] = jwtService.signAsync.mock.calls[0];
      expect(payload).toEqual({ sub: 'u1', role: 'seller' });
      expect(options).toEqual(expect.objectContaining({ algorithm: 'HS256', secret: TEST_JWT_SECRET }));
      // From the token's exp - iat, not a hard-coded 900.
      expect(result.expiresIn).toBe(600);
      expect(result.tokenType).toBe('Bearer');
    });

    it('always runs exactly one bcrypt.compare, even for an unknown login (no timing enumeration)', async () => {
      const compare = jest.spyOn(bcrypt, 'compare');
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ login: 'nobody', password: 'whatever' } as any)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      });
      expect(compare).toHaveBeenCalledTimes(1);

      // A staff row without a password hash takes the same path.
      compare.mockClear();
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', login: 'nopw', password_hash: null, is_blocked: false, shops: [] });
      await expect(service.login({ login: 'nopw', password: 'whatever' } as any)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      });
      expect(compare).toHaveBeenCalledTimes(1);
      compare.mockRestore();
    });

    it('reveals a blocked account only to someone who knows the password', async () => {
      const hash = await bcrypt.hash('right-password', 4);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', login: 'x', password_hash: hash, is_blocked: true, role: 'seller', shops: [] });

      await expect(service.login({ login: 'x', password: 'wrong' } as any)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_CREDENTIALS' }),
      });
      await expect(service.login({ login: 'x', password: 'right-password' } as any)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'USER_BLOCKED' }),
      });
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

    it('treats reuse of an already-revoked token as theft: revokes every session of that user', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        user_id: 'u-victim',
        revoked_at: new Date(Date.now() - 60_000),
        expires_at: new Date(Date.now() + 1000 * 60 * 60),
      });
      const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

      await expect(service.refreshToken('replayed')).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { user_id: 'u-victim', revoked_at: null },
        data: { revoked_at: expect.any(Date) },
      });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('u-victim'));
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('does not touch other sessions for an unknown or merely expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refreshToken('bogus')).rejects.toBeInstanceOf(UnauthorizedException);
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 'rt1', user_id: 'u1', revoked_at: null, expires_at: new Date(0) });
      await expect(service.refreshToken('expired')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const currentPassword = 'Temp-pass-1234';

    beforeEach(async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'seller',
        password_hash: await bcrypt.hash(currentPassword, 4),
        must_change_password: true,
      });
      prisma.user.update.mockResolvedValue({ id: 'u1' });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
      prisma.refreshToken.create.mockResolvedValue({});
    });

    it('updates the hash and revokes all refresh tokens in one transaction, then issues a fresh pair', async () => {
      const result = await service.changePassword('u1', { currentPassword, newPassword: 'New-pass-5678' } as any);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { password_hash: expect.any(String), must_change_password: false },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { user_id: 'u1', revoked_at: null },
        data: { revoked_at: expect.any(Date) },
      });
      // The revocation happens before the new token for this device is created.
      expect(prisma.refreshToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.refreshToken.create.mock.invocationCallOrder[0],
      );
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          accessToken: 'signed-access-token',
          refreshToken: expect.any(String),
          tokenType: 'Bearer',
          expiresIn: 600,
        }),
      );
      const newHash = prisma.user.update.mock.calls[0][0].data.password_hash;
      expect(await bcrypt.compare('New-pass-5678', newHash)).toBe(true);
    });

    it('rejects a wrong current password without touching anything', async () => {
      await expect(
        service.changePassword('u1', { currentPassword: 'nope', newPassword: 'New-pass-5678' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('sendCode in production', () => {
    const originalEnv = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('never issues the fixed dev code: 6 random digits with the real provider', async () => {
      process.env.NODE_ENV = 'production';
      configService.get.mockImplementation((key: string, def?: any) =>
        key === 'JWT_ACCESS_SECRET' ? TEST_JWT_SECRET : key === 'SMS_PROVIDER' ? 'eskiz' : def,
      );

      const codes = new Set<string>();
      for (let i = 0; i < 5; i++) {
        await service.sendCode({ phone: '+998901234567' });
        const text: string = smsService.sendSms.mock.calls[i][1];
        const match = text.match(/\b(\d{6})\b/);
        expect(match).not.toBeNull();
        codes.add(match![1]);
      }
      expect(codes.has('123456')).toBe(false);
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe('verifyCode', () => {
    const phone = '+998909876543';

    beforeEach(async () => {
      prisma.smsCode.findFirst.mockResolvedValue({
        id: 'sms-1',
        phone,
        code_hash: await bcrypt.hash('123456', 4),
        attempts: 0,
        expires_at: new Date(Date.now() + 60_000),
      });
      prisma.smsCode.delete = jest.fn().mockResolvedValue({});
      prisma.smsCode.update = jest.fn().mockResolvedValue({});
    });

    it('refuses to log a seller/admin in with an OTP (phone-only auth is customer-only)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-seller-1', phone, role: 'seller', is_blocked: false });

      await expect(service.verifyCode({ phone, code: '123456' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('logs an existing customer in and issues tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-customer-1', phone, role: 'customer', is_blocked: false });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyCode({ phone, code: '123456' });

      expect(result.isNewUser).toBe(false);
      expect(result.accessToken).toBe('signed-access-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith(expect.objectContaining({ sub: 'u-customer-1', role: 'customer' }), expect.anything());
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
