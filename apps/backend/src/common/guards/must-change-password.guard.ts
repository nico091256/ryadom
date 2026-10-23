import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@localshop/shared';

/**
 * Routes a user with `must_change_password = true` may still call. Everything
 * else is refused with 403 MUST_CHANGE_PASSWORD until the password is changed.
 * Paths are matched by suffix so the global prefix (`/api/v1`) does not matter.
 */
export const MUST_CHANGE_PASSWORD_ALLOWLIST: ReadonlyArray<readonly [method: string, path: string]> = [
  ['POST', '/auth/change-password'],
  ['POST', '/auth/logout'],
  ['GET', '/me'],
];

function normalisePath(req: { route?: { path?: string }; path?: string; url?: string }): string {
  const raw = req.route?.path ?? req.path ?? (req.url ?? '').split('?')[0];
  return raw.replace(/\/+$/, '');
}

export function isAllowedWhilePasswordChangePending(method: string, path: string): boolean {
  const m = method.toUpperCase();
  return MUST_CHANGE_PASSWORD_ALLOWLIST.some(([allowedMethod, allowedPath]) => {
    if (allowedMethod !== m) return false;
    return path === allowedPath || path.endsWith(allowedPath);
  });
}

/**
 * Server-side enforcement of the "temporary password" state the admin panel
 * creates (new shop / password reset): a staff account flagged
 * `must_change_password` can only change its password, log out or read /me.
 * `@Public()` routes carry no `req.user` and therefore pass.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest();
    if (!req?.user?.must_change_password) return true;

    if (isAllowedWhilePasswordChangePending(req.method ?? '', normalisePath(req))) return true;

    throw new ForbiddenException({
      code: ERROR_CODES.MUST_CHANGE_PASSWORD,
      message: 'You must change your temporary password before using the API.',
    });
  }
}
