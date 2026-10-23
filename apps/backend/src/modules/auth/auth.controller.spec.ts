import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './refresh-cookie';

/**
 * Cookie transport for the web panels: with `X-Auth-Transport: cookie` the
 * refresh token travels only as an httpOnly cookie; mobile clients (no header)
 * keep receiving it in the JSON body.
 */
describe('AuthController refresh-token transport', () => {
  const tokens = {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    tokenType: 'Bearer',
    expiresIn: 900,
  };

  let authService: {
    login: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
    changePassword: jest.Mock;
  };
  let controller: AuthController;

  const makeReq = (opts: { header?: string; cookie?: string } = {}) =>
    ({
      headers: opts.header ? { 'x-auth-transport': opts.header } : {},
      cookies: opts.cookie ? { [REFRESH_COOKIE_NAME]: opts.cookie } : {},
    }) as any;

  const makeRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as any;

  beforeEach(() => {
    authService = {
      login: jest.fn().mockResolvedValue({ ...tokens, user: { id: 'u1', role: 'seller' } }),
      refreshToken: jest.fn().mockResolvedValue({ ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' }),
      logout: jest.fn().mockResolvedValue({ success: true }),
      changePassword: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'ok', ...tokens, accessToken: 'access-3', refreshToken: 'refresh-3' }),
    };
    const configService = { get: jest.fn((_key: string, def?: any) => def) };
    controller = new AuthController(authService as any, configService as any);
  });

  describe('login', () => {
    it('without the header returns the refresh token in the body and sets no cookie (mobile)', async () => {
      const res = makeRes();
      const body: any = await controller.login({ login: 'x', password: 'y' }, makeReq(), res);

      expect(body.refreshToken).toBe('refresh-1');
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('with X-Auth-Transport: cookie sets an httpOnly cookie and omits refreshToken from the body', async () => {
      const res = makeRes();
      const body = await controller.login({ login: 'x', password: 'y' }, makeReq({ header: 'cookie' }), res);

      expect(body).not.toHaveProperty('refreshToken');
      expect(body.accessToken).toBe('access-1');
      expect(body.user).toEqual({ id: 'u1', role: 'seller' });
      expect(res.cookie).toHaveBeenCalledTimes(1);

      const [name, value, options] = res.cookie.mock.calls[0];
      expect(name).toBe(REFRESH_COOKIE_NAME);
      expect(value).toBe('refresh-1');
      expect(options).toEqual(
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: REFRESH_COOKIE_PATH,
          maxAge: 30 * 24 * 60 * 60 * 1000, // REFRESH_TOKEN_TTL_DAYS default
        }),
      );
      // Secure only in production.
      expect(options.secure).toBe(process.env.NODE_ENV === 'production');
    });
  });

  describe('refresh', () => {
    it('rejects with 401 INVALID_REFRESH_TOKEN when neither body nor cookie carries a token', async () => {
      const res = makeRes();
      await expect(controller.refresh({}, makeReq(), res)).rejects.toMatchObject({
        status: 401,
        response: expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }),
      });
      expect(authService.refreshToken).not.toHaveBeenCalled();
    });

    it('uses the body token when present (mobile) and returns the rotated token in the body', async () => {
      const res = makeRes();
      const body: any = await controller.refresh({ refreshToken: 'from-body' }, makeReq({ cookie: 'from-cookie' }), res);

      expect(authService.refreshToken).toHaveBeenCalledWith('from-body');
      expect(body.refreshToken).toBe('refresh-2');
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('uses the cookie when the body is empty, rotates it and omits refreshToken from the body', async () => {
      const res = makeRes();
      const body = await controller.refresh({}, makeReq({ cookie: 'from-cookie' }), res);

      expect(authService.refreshToken).toHaveBeenCalledWith('from-cookie');
      expect(body).not.toHaveProperty('refreshToken');
      expect(body.accessToken).toBe('access-2');
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'refresh-2',
        expect.objectContaining({ httpOnly: true, path: REFRESH_COOKIE_PATH }),
      );
    });

    it('clears a dead cookie when the cookie-borne token is rejected', async () => {
      authService.refreshToken.mockRejectedValue(new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN' }));
      const res = makeRes();

      await expect(controller.refresh({}, makeReq({ cookie: 'stale' }), res)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, expect.objectContaining({ path: REFRESH_COOKIE_PATH }));
    });
  });

  describe('logout', () => {
    it('revokes the cookie token and clears the cookie', async () => {
      const res = makeRes();
      const body = await controller.logout({}, makeReq({ cookie: 'from-cookie' }), res);

      expect(authService.logout).toHaveBeenCalledWith('from-cookie');
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, expect.objectContaining({ httpOnly: true }));
      expect(body).toEqual({ success: true });
    });

    it('revokes the body token without touching cookies (mobile)', async () => {
      const res = makeRes();
      await controller.logout({ refreshToken: 'from-body' }, makeReq(), res);

      expect(authService.logout).toHaveBeenCalledWith('from-body');
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('returns 401 when no token is available anywhere', async () => {
      await expect(controller.logout({}, makeReq(), makeRes())).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.logout).not.toHaveBeenCalled();
    });
  });

  describe('change-password', () => {
    const dto = { currentPassword: 'old', newPassword: 'new-password-1' } as any;

    it('returns the fresh token pair in the body for mobile-style clients', async () => {
      const res = makeRes();
      const body: any = await controller.changePassword('u1', dto, makeReq(), res);

      expect(authService.changePassword).toHaveBeenCalledWith('u1', dto);
      expect(body).toEqual(expect.objectContaining({ success: true, accessToken: 'access-3', refreshToken: 'refresh-3' }));
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('with X-Auth-Transport: cookie rotates the httpOnly cookie and omits refreshToken from the body', async () => {
      const res = makeRes();
      const body: any = await controller.changePassword('u1', dto, makeReq({ header: 'cookie' }), res);

      expect(body).not.toHaveProperty('refreshToken');
      expect(body.accessToken).toBe('access-3');
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'refresh-3',
        expect.objectContaining({ httpOnly: true, path: REFRESH_COOKIE_PATH }),
      );
    });

    it('also treats a request that carries the refresh cookie as a cookie client', async () => {
      const res = makeRes();
      const body: any = await controller.changePassword('u1', dto, makeReq({ cookie: 'old-cookie' }), res);

      expect(body).not.toHaveProperty('refreshToken');
      expect(res.cookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, 'refresh-3', expect.anything());
    });
  });
});
