import { ConfigService } from '@nestjs/config';
import { JWT_ACCESS_SECRET_MIN_LENGTH } from './env.validation';

/**
 * Single accessor for the JWT access-token secret. `validateEnv` guarantees the
 * value exists (or was defaulted in non-production) before any module is built,
 * so there is intentionally no hardcoded fallback here.
 */
export function getJwtAccessSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_ACCESS_SECRET');
  if (!secret || secret.length < JWT_ACCESS_SECRET_MIN_LENGTH) {
    throw new Error(
      `JWT_ACCESS_SECRET is not configured (need >= ${JWT_ACCESS_SECRET_MIN_LENGTH} chars). See .env.example.`,
    );
  }
  return secret;
}
