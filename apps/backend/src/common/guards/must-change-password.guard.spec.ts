import { ForbiddenException } from '@nestjs/common';
import { MustChangePasswordGuard, isAllowedWhilePasswordChangePending } from './must-change-password.guard';

describe('MustChangePasswordGuard', () => {
  const guard = new MustChangePasswordGuard();

  const makeContext = (req: Record<string, unknown>, type: string = 'http') =>
    ({
      getType: () => type,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as any;

  const pendingUser = { id: 'u1', role: 'seller', must_change_password: true };

  it('passes when there is no user (public route)', () => {
    expect(guard.canActivate(makeContext({ method: 'GET', path: '/api/v1/shops' }))).toBe(true);
  });

  it('passes when the user does not have to change the password', () => {
    const req = { method: 'GET', path: '/api/v1/seller/orders', user: { ...pendingUser, must_change_password: false } };
    expect(guard.canActivate(makeContext(req))).toBe(true);
  });

  it.each([
    ['POST', '/api/v1/auth/change-password'],
    ['POST', '/api/v1/auth/logout'],
    ['GET', '/api/v1/me'],
    ['GET', '/api/v1/me/'],
  ])('lets a pending user call %s %s', (method, path) => {
    expect(guard.canActivate(makeContext({ method, path, user: pendingUser }))).toBe(true);
  });

  it('prefers the matched Express route path over the raw url', () => {
    const req = { method: 'GET', route: { path: '/api/v1/me' }, path: '/api/v1/me?x=1', user: pendingUser };
    expect(guard.canActivate(makeContext(req))).toBe(true);
  });

  it.each([
    ['GET', '/api/v1/seller/orders'],
    ['PATCH', '/api/v1/me'],
    ['POST', '/api/v1/uploads/image'],
    ['GET', '/api/v1/admin/shops'],
  ])('refuses %s %s with 403 MUST_CHANGE_PASSWORD', (method, path) => {
    let caught: unknown;
    try {
      guard.canActivate(makeContext({ method, path, user: pendingUser }));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ForbiddenException);
    expect((caught as ForbiddenException).getResponse()).toEqual(
      expect.objectContaining({ code: 'MUST_CHANGE_PASSWORD' }),
    );
  });

  it('does not apply to non-HTTP contexts (websockets)', () => {
    expect(guard.canActivate(makeContext({ user: pendingUser }, 'ws'))).toBe(true);
  });

  it('isAllowedWhilePasswordChangePending is method-sensitive', () => {
    expect(isAllowedWhilePasswordChangePending('get', '/me')).toBe(true);
    expect(isAllowedWhilePasswordChangePending('PATCH', '/me')).toBe(false);
    expect(isAllowedWhilePasswordChangePending('GET', '/auth/change-password')).toBe(false);
  });
});
