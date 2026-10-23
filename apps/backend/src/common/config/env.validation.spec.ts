import { DEV_JWT_ACCESS_SECRET, EnvValidationError, validateEnv } from './env.validation';

const STRONG_SECRET = 'a'.repeat(64);

describe('validateEnv', () => {
  const logger = { warn: jest.fn() };

  beforeEach(() => logger.warn.mockClear());

  describe('production', () => {
    const validProd = {
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: STRONG_SECRET,
      DATABASE_URL: 'postgresql://u:p@db:5432/localshop?schema=public',
      REDIS_HOST: 'redis',
      CORS_ORIGINS: 'https://admin.ryadom.uz,https://store.ryadom.uz',
      SMS_PROVIDER: 'eskiz',
    };

    it('refuses the mock SMS provider (fixed OTP) in production, explicitly or by default', () => {
      expect(() => validateEnv({ ...validProd, SMS_PROVIDER: 'mock' }, logger)).toThrow(/SMS_PROVIDER must be "eskiz"/);
      const { SMS_PROVIDER: _omit, ...unset } = validProd;
      expect(() => validateEnv(unset, logger)).toThrow(/SMS_PROVIDER must be "eskiz"/);
    });

    it('accepts a complete production config unchanged', () => {
      expect(validateEnv(validProd, logger)).toEqual(validProd);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('throws when CORS_ORIGINS is missing', () => {
      const { CORS_ORIGINS: _omit, ...noCors } = validProd;
      expect(() => validateEnv(noCors, logger)).toThrow(EnvValidationError);
      expect(() => validateEnv(noCors, logger)).toThrow(/CORS_ORIGINS is required when NODE_ENV=production/);
    });

    it('throws when DATABASE_URL or REDIS_HOST are missing and lists every problem', () => {
      const { DATABASE_URL: _d, REDIS_HOST: _r, ...broken } = validProd;
      let caught: unknown;
      try {
        validateEnv(broken, logger);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(EnvValidationError);
      expect((caught as EnvValidationError).problems).toEqual(
        expect.arrayContaining([expect.stringMatching(/DATABASE_URL/), expect.stringMatching(/REDIS_HOST/)]),
      );
    });

    it('refuses the development default JWT secret', () => {
      expect(() => validateEnv({ ...validProd, JWT_ACCESS_SECRET: DEV_JWT_ACCESS_SECRET }, logger)).toThrow(
        /must not be the development default/,
      );
    });

    it('refuses a missing JWT secret instead of falling back', () => {
      const { JWT_ACCESS_SECRET: _s, ...noSecret } = validProd;
      expect(() => validateEnv(noSecret, logger)).toThrow(/JWT_ACCESS_SECRET is required/);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('rejects malformed CORS_ORIGINS entries', () => {
      expect(() => validateEnv({ ...validProd, CORS_ORIGINS: 'https://ok.example, not-an-origin' }, logger)).toThrow(
        /CORS_ORIGINS entries must be origins/,
      );
    });

    it('refuses THROTTLE_DISABLED=true (load-test switch) in production', () => {
      expect(() => validateEnv({ ...validProd, THROTTLE_DISABLED: 'true' }, logger)).toThrow(/THROTTLE_DISABLED=true is not allowed/);
      expect(validateEnv({ ...validProd, THROTTLE_DISABLED: 'false' }, logger).THROTTLE_DISABLED).toBe('false');
    });
  });

  describe('development / test', () => {
    it('falls back to the dev default secret and warns once when JWT_ACCESS_SECRET is missing', () => {
      const out = validateEnv({ NODE_ENV: 'development' }, logger);
      expect(out.JWT_ACCESS_SECRET).toBe(DEV_JWT_ACCESS_SECRET);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toMatch(/INSECURE development default/);
    });

    it('does not warn and does not require DATABASE_URL/REDIS_HOST/CORS_ORIGINS when a secret is set', () => {
      const out = validateEnv({ JWT_ACCESS_SECRET: STRONG_SECRET }, logger);
      expect(out.JWT_ACCESS_SECRET).toBe(STRONG_SECRET);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('still rejects a secret shorter than 32 characters', () => {
      expect(() => validateEnv({ JWT_ACCESS_SECRET: 'too-short' }, logger)).toThrow(/at least 32 characters/);
    });

    it('allows THROTTLE_DISABLED=true outside production but warns loudly', () => {
      const out = validateEnv({ JWT_ACCESS_SECRET: STRONG_SECRET, THROTTLE_DISABLED: 'true' }, logger);
      expect(out.THROTTLE_DISABLED).toBe('true');
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toMatch(/rate limiting is OFF/);
      expect(() => validateEnv({ JWT_ACCESS_SECRET: STRONG_SECRET, THROTTLE_DISABLED: 'yes' }, logger)).toThrow(/THROTTLE_DISABLED/);
    });

    it('rejects a TRUST_PROXY value other than true/false', () => {
      expect(() => validateEnv({ JWT_ACCESS_SECRET: STRONG_SECRET, TRUST_PROXY: '1' }, logger)).toThrow(/TRUST_PROXY/);
      expect(validateEnv({ JWT_ACCESS_SECRET: STRONG_SECRET, TRUST_PROXY: 'true' }, logger).TRUST_PROXY).toBe('true');
    });
  });
});
