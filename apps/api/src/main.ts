import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
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
  const config = new DocumentBuilder()
    .setTitle('Local Shop Delivery Platform API')
    .setDescription(
      'Hyper-local shop delivery platform backend API for customers, shopkeepers, and administrators in Uzbekistan.',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('Auth', 'SMS verification and JWT authentication')
    .addTag('Profile', 'User profile and push token registration')
    .addTag('Addresses', 'Customer delivery addresses')
    .addTag('Shops', 'Nearby shops and product catalog browsing')
    .addTag('Cart', 'Single-shop cart operations')
    .addTag('Orders', 'Order placement, lifecycle state machine, and status updates')
    .addTag('Seller', 'Shopkeeper catalog management and store operations')
    .addTag('Admin', 'Platform administration, shop onboarding, categories, and metrics')
    .addTag('Uploads', 'Image uploads')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'LocalShop API Docs',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 LocalShop API is running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger Documentation is available on: http://localhost:${port}/docs`);
}

bootstrap();
