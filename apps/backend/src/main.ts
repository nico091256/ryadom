import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
// cookie-parser is CommonJS (`module.exports = fn`) and this tsconfig has no esModuleInterop.
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { captureException, initSentry } from './common/observability/sentry';
import { buildSwaggerDocument } from './swagger.config';

/**
 * Last-resort handlers. A rejected fire-and-forget promise (push, cache, job)
 * must be logged and reported, not silently dropped or left to Node's default
 * behaviour. An uncaught exception leaves the process in an unknown state, so
 * after logging we exit non-zero and let the orchestrator restart us.
 */
function registerProcessHandlers() {
  const logger = new Logger('Process');
  process.on('unhandledRejection', (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`Unhandled promise rejection: ${err.message}`, err.stack);
    captureException(err, { source: 'unhandledRejection' });
  });
  process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught exception, shutting down: ${err.message}`, err.stack);
    captureException(err, { source: 'uncaughtException' });
    process.exit(1);
  });
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // No-op unless SENTRY_DSN is set; must run before the app (and its filters) is created.
  initSentry(process.env);
  registerProcessHandlers();

  // Credentialed (cookie) requests need an explicit origin list in production;
  // validateEnv() refuses to boot without CORS_ORIGINS there. In development
  // `origin: true` reflects the request origin (never a literal '*').
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : true;
  if (isProduction && corsOrigins === true) {
    throw new Error('CORS_ORIGINS must be set in production (comma-separated list of allowed origins).');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  // Behind a reverse proxy / load balancer the throttler must key on the real
  // client IP (X-Forwarded-For). Opt-in only: trusting the header on a directly
  // exposed server lets clients spoof their IP.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
    logger.log('TRUST_PROXY=true: honouring X-Forwarded-For from the first proxy hop');
  }

  // httpOnly refresh-token cookie for the web panels (see modules/auth/refresh-cookie.ts)
  app.use(cookieParser());

  // Security HTTP headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  // Global prefix as specified in Technical Spec v2 Section 13: All paths start with /api/v1
  app.setGlobalPrefix('api/v1');

  // Serve static files for uploaded images (avatars, product photos, shop logos)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Global request validation pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // Reject (400) instead of silently stripping unknown body fields.
      forbidNonWhitelisted: true,
    }),
  );

  // OpenAPI (Swagger) API documentation served at /docs (Section 11)
  const enableSwagger = process.env.ENABLE_SWAGGER === 'true' || !isProduction;

  if (enableSwagger) {
    const document = buildSwaggerDocument(app);
    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: 'LocalShop API Docs',
    });
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 LocalShop API is running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger Documentation is available on: http://localhost:${port}/docs`);
}

bootstrap();
