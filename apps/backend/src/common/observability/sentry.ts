import * as Sentry from '@sentry/node';

let enabled = false;

/**
 * Initialises Sentry only when SENTRY_DSN is set. Call once in main.ts BEFORE
 * NestFactory.create so the SDK can instrument http/express:
 *   initSentry(process.env);
 */
export function initSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || 'development',
    release: env.SENTRY_RELEASE || undefined,
    tracesSampleRate: 0.1,
  });
  enabled = true;
  return true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/** Forwards an error to Sentry when initialised; a no-op otherwise. */
export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    Sentry.captureException(err, extra ? { extra } : undefined);
  } catch {
    // Observability must never break the request path.
  }
}

/** Test-only hook. */
export function _resetSentryForTests(): void {
  enabled = false;
}
