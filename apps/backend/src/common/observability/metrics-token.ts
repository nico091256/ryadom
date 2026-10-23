import { timingSafeEqual } from 'crypto';

/**
 * Shared gate for the operational endpoints (GET /metrics, GET /health/details).
 * With METRICS_TOKEN unset the endpoint is open (private network); otherwise the
 * caller must send `Authorization: Bearer <METRICS_TOKEN>`. The comparison is
 * constant-time so the token cannot be recovered byte by byte from timing.
 */
export function metricsTokenAccepted(authorization: string | undefined): boolean {
  const required = process.env.METRICS_TOKEN;
  if (!required) return true;
  if (typeof authorization !== 'string') return false;

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) return false;

  const presented = Buffer.from(match[1], 'utf8');
  const expected = Buffer.from(required, 'utf8');
  // timingSafeEqual throws on length mismatch; unequal lengths are simply a mismatch.
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
