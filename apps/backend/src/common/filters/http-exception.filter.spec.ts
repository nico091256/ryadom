import { ArgumentsHost, BadRequestException, ConflictException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';
import * as sentry from '../observability/sentry';

function mockHost() {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = { method: 'GET', originalUrl: '/api/v1/test' };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

function known(code: string) {
  return new Prisma.PrismaClientKnownRequestError('db says no: users_phone_key', { code, clientVersion: '5.22.0' });
}

describe('HttpExceptionFilter', () => {
  const originalEnv = process.env.NODE_ENV;
  let filter: HttpExceptionFilter;
  let capture: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    capture = jest.spyOn(sentry, 'captureException').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('passes HttpException code/message/status through unchanged', () => {
    const { host, response } = mockHost();
    filter.catch(new ConflictException({ code: 'PROMO_CODE_EXISTS', message: 'exists' }), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PROMO_CODE_EXISTS', message: 'exists', statusCode: 409, timestamp: expect.any(String) }),
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it('joins ValidationPipe message arrays and exposes them as details', () => {
    const { host, response } = mockHost();
    filter.catch(new BadRequestException(['lat must be a number', 'lng must be a number']), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'BAD_REQUEST',
        message: 'lat must be a number, lng must be a number',
        details: ['lat must be a number', 'lng must be a number'],
      }),
    );
  });

  it.each([
    ['P2002', HttpStatus.CONFLICT, 'ALREADY_EXISTS'],
    ['P2025', HttpStatus.NOT_FOUND, 'NOT_FOUND'],
    ['P2003', HttpStatus.BAD_REQUEST, 'INVALID_REFERENCE'],
  ])('maps Prisma %s to %i %s without leaking the constraint name', (code, status, apiCode) => {
    const { host, response } = mockHost();
    filter.catch(known(code), host);

    expect(response.status).toHaveBeenCalledWith(status);
    const body = response.json.mock.calls[0][0];
    expect(body.code).toBe(apiCode);
    expect(body.message).not.toContain('users_phone_key');
    expect(capture).not.toHaveBeenCalled();
  });

  it('treats other Prisma request errors as a generic 500 and reports them', () => {
    process.env.NODE_ENV = 'production';
    const { host, response } = mockHost();
    filter.catch(known('P1001'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json.mock.calls[0][0]).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('maps PrismaClientValidationError to 400 BAD_REQUEST "Invalid request."', () => {
    const { host, response } = mockHost();
    filter.catch(new Prisma.PrismaClientValidationError('Unknown arg `foo` in data.foo', { clientVersion: '5.22.0' }), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json.mock.calls[0][0]).toMatchObject({ code: 'BAD_REQUEST', message: 'Invalid request.' });
  });

  it('masks unknown Error messages in production but reports them to Sentry', () => {
    process.env.NODE_ENV = 'production';
    const { host, response } = mockHost();
    filter.catch(new Error('connect ECONNREFUSED 10.0.0.5:5432'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json.mock.calls[0][0].message).toBe('An unexpected error occurred');
    expect(capture).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ statusCode: 500, url: '/api/v1/test' }));
  });

  it('shows the real message of unknown errors outside production', () => {
    process.env.NODE_ENV = 'development';
    const { host, response } = mockHost();
    filter.catch(new Error('connect ECONNREFUSED 10.0.0.5:5432'), host);

    expect(response.json.mock.calls[0][0].message).toBe('connect ECONNREFUSED 10.0.0.5:5432');
  });

  it('handles non-Error throwables with the generic 500 shape', () => {
    const { host, response } = mockHost();
    filter.catch('boom', host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json.mock.calls[0][0]).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', statusCode: 500 });
  });
});
