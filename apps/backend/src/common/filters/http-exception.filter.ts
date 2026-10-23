import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { captureException } from '../observability/sentry';

const GENERIC_MESSAGE = 'An unexpected error occurred';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = GENERIC_MESSAGE;
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionRes = exception.getResponse();

      if (typeof exceptionRes === 'string') {
        message = exceptionRes;
        code = this.statusToCode(status);
      } else if (typeof exceptionRes === 'object' && exceptionRes !== null) {
        const resObj = exceptionRes as Record<string, any>;
        code = resObj.code || this.statusToCode(status);
        message = Array.isArray(resObj.message) ? resObj.message.join(', ') : resObj.message || message;
        details = resObj.details || (Array.isArray(resObj.message) ? resObj.message : undefined);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Map the handful of Prisma errors that are really client faults; everything
      // else is a server fault and must not leak table/constraint names.
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          code = 'ALREADY_EXISTS';
          message = 'A record with these values already exists.';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'The requested record was not found.';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          code = 'INVALID_REFERENCE';
          message = 'A referenced record does not exist.';
          break;
        default:
          this.logger.error(
            `Unhandled Prisma error ${exception.code} on ${request?.method} ${request?.originalUrl ?? request?.url}: ${exception.message}`,
            exception.stack,
          );
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      // Malformed query arguments (wrong types, unknown fields) that slipped past the DTO layer.
      this.logger.warn(`Prisma validation error on ${request?.method} ${request?.originalUrl ?? request?.url}: ${exception.message}`);
      status = HttpStatus.BAD_REQUEST;
      code = 'BAD_REQUEST';
      message = 'Invalid request.';
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      // The real message is a debugging aid for developers only; in production it may
      // carry internals (hostnames, SQL, file paths) that clients must never see.
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message || GENERIC_MESSAGE;
      }
    }

    // Only server faults go to Sentry (no-op unless SENTRY_DSN is set); 4xx are expected client errors.
    if (status >= 500) {
      captureException(exception, {
        method: request?.method,
        url: request?.originalUrl ?? request?.url,
        statusCode: status,
        code,
      });
    }

    response.status(status).json({
      code,
      message,
      ...(details ? { details } : {}),
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
