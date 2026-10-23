import * as Sentry from '@sentry/node';
import { _resetSentryForTests, captureException, initSentry, isSentryEnabled, scrubEvent } from './sentry';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

describe('sentry', () => {
  beforeEach(() => {
    _resetSentryForTests();
    jest.clearAllMocks();
  });

  it('stays disabled without SENTRY_DSN', () => {
    expect(initSentry({})).toBe(false);
    expect(isSentryEnabled()).toBe(false);
    captureException(new Error('x'));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('initialises with PII collection switched off and a scrubbing beforeSend', () => {
    expect(initSentry({ SENTRY_DSN: 'https://k@o0.ingest.sentry.io/1', NODE_ENV: 'production' })).toBe(true);

    const options = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(options).toMatchObject({
      environment: 'production',
      dataCollection: {
        httpBodies: [],
        cookies: false,
        userInfo: false,
        urlQueryParams: false,
        httpHeaders: { request: false, response: false },
        databaseQueryData: false,
      },
    });
    expect(typeof options.beforeSend).toBe('function');
    // v11 has no sendDefaultPii; PII opt-out is the dataCollection block above.
    expect(options.sendDefaultPii).toBeUndefined();

    const scrubbed = options.beforeSend({
      message: 'boom',
      request: {
        url: '/api/v1/auth/verify',
        method: 'POST',
        data: { phone: '+998901234567', code: '123456' },
        cookies: { refresh_token: 'rt' },
        headers: { authorization: 'Bearer x' },
        query_string: 'lat=41.3&lng=69.2',
      },
      user: { id: 'u1', ip_address: '1.2.3.4', username: 'ali' },
    });
    expect(scrubbed.request).toEqual({ url: '/api/v1/auth/verify', method: 'POST' });
    expect(scrubbed.user).toEqual({ id: 'u1' });
    expect(scrubbed.message).toBe('boom');
  });

  it('scrubEvent tolerates events without request/user', () => {
    expect(scrubEvent({ message: 'x' } as any)).toEqual({ message: 'x' });
    expect(scrubEvent({ user: { ip_address: '1.1.1.1' } } as any).user).toBeUndefined();
  });

  it('captureException forwards extra context once enabled', () => {
    initSentry({ SENTRY_DSN: 'https://k@o0.ingest.sentry.io/1' });
    const err = new Error('db');
    captureException(err, { statusCode: 500 });
    expect(Sentry.captureException).toHaveBeenCalledWith(err, { extra: { statusCode: 500 } });
  });
});
