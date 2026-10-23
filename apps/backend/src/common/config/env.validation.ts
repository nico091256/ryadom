import { Logger } from '@nestjs/common';

/**
 * Historical development secret. It is still accepted as an automatic fallback
 * outside production (with a loud warning) so local `nest start` keeps working,
 * but production must never boot with it.
 */
export const DEV_JWT_ACCESS_SECRET = 'super-secret-jwt-access-key-minimum-32-chars-long';
export const JWT_ACCESS_SECRET_MIN_LENGTH = 32;

const PRODUCTION_REQUIRED = ['DATABASE_URL', 'REDIS_HOST', 'CORS_ORIGINS'] as const;

export class EnvValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
    this.name = 'EnvValidationError';
  }
}

interface EnvLogger {
  warn(message: string): void;
}

function readString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Fail-fast environment validation for `ConfigModule.forRoot({ validate })`.
 *
 * Always required: `JWT_ACCESS_SECRET` (>= 32 chars). In production additionally
 * `DATABASE_URL`, `REDIS_HOST` and `CORS_ORIGINS` must be set and the JWT secret
 * must not be the old development default. Outside production a missing secret
 * falls back to the development default and logs a single loud warning.
 *
 * Returns the (possibly defaulted) config; Nest assigns it to process.env.
 */
export function validateEnv(
  config: Record<string, unknown>,
  logger: EnvLogger = new Logger('EnvValidation'),
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  const isProduction = readString(out, 'NODE_ENV') === 'production';
  const problems: string[] = [];

  let secret = readString(out, 'JWT_ACCESS_SECRET');
  if (!secret) {
    if (isProduction) {
      problems.push(
        `JWT_ACCESS_SECRET is required (>= ${JWT_ACCESS_SECRET_MIN_LENGTH} random chars, e.g. \`openssl rand -hex 32\`)`,
      );
    } else {
      logger.warn(
        '!!! JWT_ACCESS_SECRET is not set - falling back to the INSECURE development default. ' +
          'Generate one with `openssl rand -hex 32` and put it in .env before deploying anywhere.',
      );
      secret = DEV_JWT_ACCESS_SECRET;
      out.JWT_ACCESS_SECRET = secret;
    }
  } else if (secret.length < JWT_ACCESS_SECRET_MIN_LENGTH) {
    problems.push(`JWT_ACCESS_SECRET must be at least ${JWT_ACCESS_SECRET_MIN_LENGTH} characters long`);
  }

  if (isProduction) {
    if (secret && secret === DEV_JWT_ACCESS_SECRET) {
      problems.push('JWT_ACCESS_SECRET must not be the development default in production');
    }
    for (const key of PRODUCTION_REQUIRED) {
      if (!readString(out, key)) problems.push(`${key} is required when NODE_ENV=production`);
    }
    // The mock SMS provider makes the OTP a fixed, public value - never acceptable in production.
    if ((readString(out, 'SMS_PROVIDER') || 'mock') !== 'eskiz') {
      problems.push('SMS_PROVIDER must be "eskiz" when NODE_ENV=production (the mock provider issues a fixed OTP)');
    }
  }

  const corsOrigins = readString(out, 'CORS_ORIGINS');
  if (corsOrigins) {
    const bad = corsOrigins
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o && !/^https?:\/\/[^\s/]+$/i.test(o));
    if (bad.length) {
      problems.push(`CORS_ORIGINS entries must be origins like https://admin.example.com (got: ${bad.join(', ')})`);
    }
  }

  const trustProxy = readString(out, 'TRUST_PROXY');
  if (trustProxy && trustProxy !== 'true' && trustProxy !== 'false') {
    problems.push(`TRUST_PROXY must be "true" or "false" (got: ${trustProxy})`);
  }

  const throttleDisabled = readString(out, 'THROTTLE_DISABLED');
  if (throttleDisabled && throttleDisabled !== 'true' && throttleDisabled !== 'false') {
    problems.push(`THROTTLE_DISABLED must be "true" or "false" (got: ${throttleDisabled})`);
  }
  if (throttleDisabled === 'true') {
    if (isProduction) problems.push('THROTTLE_DISABLED=true is not allowed when NODE_ENV=production');
    else logger.warn('!!! THROTTLE_DISABLED=true - rate limiting is OFF (load-test mode). Never deploy like this.');
  }

  if (problems.length) throw new EnvValidationError(problems);
  return out;
}
