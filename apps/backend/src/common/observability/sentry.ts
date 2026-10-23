import * as Sentry from '@sentry/node';

let enabled = false;

/**
 * Removes request payloads that may carry PII or credentials (bodies with
 * phone numbers / passwords / OTPs, cookies with the refresh token, auth
 * headers, query strings with coordinates). Applied in `beforeSend` as a
 * belt-and-braces layer on top of the `dataCollection` opt-outs below.
 */
export function scrubEvent<T extends { request?: Record<string, any>; user?: Record<string, any> }>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }
  if (event.user) {
    // Keep only the opaque id, never ip/email/username.
    event.user = event.user.id !== undefined ? { id: event.user.id } : undefined;
  }
  return event;
}

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
    // @sentry/node v11 replaced `sendDefaultPii` with the granular `dataCollection`
    // block (the option no longer type-checks): switch off every automatically
    // collected request/DB payload.
    dataCollection: {
      httpBodies: [],
      cookies: false,
      userInfo: false,
      urlQueryParams: false,
      httpHeaders: { request: false, response: false },
      databaseQueryData: false,
    },
    beforeSend: (event) => scrubEvent(event),
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
