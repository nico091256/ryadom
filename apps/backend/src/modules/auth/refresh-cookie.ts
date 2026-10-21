import type { CookieOptions, Request, Response } from 'express';

/**
 * httpOnly refresh-token transport for the web panels (admin / store).
 *
 * A client opts in by sending `X-Auth-Transport: cookie` on POST /auth/login.
 * The refresh token is then delivered only as an httpOnly cookie scoped to the
 * auth routes and omitted from the JSON body. Mobile clients never send the
 * header and keep receiving the token in the body.
 */
export const REFRESH_COOKIE_NAME = 'ryadom_rt';
export const AUTH_TRANSPORT_HEADER = 'x-auth-transport';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: REFRESH_COOKIE_PATH,
  };
}

export function wantsCookieTransport(req: Request): boolean {
  const raw = req.headers[AUTH_TRANSPORT_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim().toLowerCase() === 'cookie';
}

export function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function setRefreshCookie(res: Response, refreshToken: string, ttlDays: number): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...baseOptions(),
    maxAge: ttlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
}
