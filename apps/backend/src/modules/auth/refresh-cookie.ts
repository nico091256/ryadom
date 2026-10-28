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
export const AUTH_CLIENT_HEADER = 'x-auth-client';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: REFRESH_COOKIE_PATH,
  };
}

export function getCookieName(req?: Request): string {
  if (!req) return REFRESH_COOKIE_NAME;
  const raw = req.headers[AUTH_CLIENT_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const client = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (client === 'store') return 'ryadom_rt_store';
  if (client === 'admin') return 'ryadom_rt_admin';
  return REFRESH_COOKIE_NAME;
}

export function wantsCookieTransport(req: Request): boolean {
  const raw = req.headers[AUTH_TRANSPORT_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim().toLowerCase() === 'cookie';
}

export function readRefreshCookie(req: Request): string | undefined {
  const specificName = getCookieName(req);
  const val = req.cookies?.[specificName];
  if (typeof val === 'string' && val.length > 0) return val;

  // Fallback to legacy shared cookie
  const fallback = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : undefined;
}

export function setRefreshCookie(res: Response, refreshToken: string, ttlDays: number, req?: Request): void {
  const cookieName = getCookieName(req);
  res.cookie(cookieName, refreshToken, {
    ...baseOptions(),
    maxAge: ttlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response, req?: Request): void {
  const cookieName = getCookieName(req);
  res.clearCookie(cookieName, baseOptions());
  // Also clear legacy cookie just in case
  if (cookieName !== REFRESH_COOKIE_NAME) {
    res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
  }
}

