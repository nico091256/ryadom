import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Single source of truth for the OpenAPI document, shared between the live
 * /docs endpoint (main.ts) and the offline export script used to generate
 * Dart API clients/models (scripts/export-openapi.ts).
 */
export function buildSwaggerDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Local Shop Delivery Platform API')
    .setDescription(
      'Hyper-local shop delivery platform backend API for customers, shopkeepers, and administrators in Uzbekistan.',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('Auth', 'SMS verification and JWT authentication')
    .addTag('Profile', 'User profile, addresses and device push tokens')
    .addTag('Addresses', 'Customer delivery addresses')
    .addTag('Shops', 'Nearby shops, self-registration and product catalog browsing')
    .addTag('Cart', 'Single-shop cart operations')
    .addTag('Orders', 'Order placement, lifecycle state machine, and status updates')
    .addTag('Seller', 'Shopkeeper catalog management and store operations')
    .addTag('Admin', 'Platform administration, shop onboarding, categories, and metrics')
    .addTag('Uploads', 'Image uploads')
    .build();

  return SwaggerModule.createDocument(app, config);
}
