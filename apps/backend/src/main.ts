import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { buildSwaggerDocument } from './swagger.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : true;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

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
      forbidNonWhitelisted: false,
    }),
  );

  // OpenAPI (Swagger) API documentation served at /docs (Section 11)
  const isProduction = process.env.NODE_ENV === 'production';
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
