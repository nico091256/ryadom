import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { FirebaseModule } from './common/firebase/firebase.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './common/config/env.validation';
import { SmsModule } from './modules/sms/sms.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DevicesModule } from './modules/devices/devices.module';
import { ShopsModule } from './modules/shops/shops.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SellerModule } from './modules/seller/seller.module';
import { AdminModule } from './modules/admin/admin.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      // Fail fast on a broken deployment (missing/weak JWT secret, no CORS list in prod, ...).
      validate: (config) => validateEnv(config),
    }),
    // Global baseline; the auth endpoints add stricter per-route windows via @Throttle.
    // THROTTLE_DISABLED=true switches every limiter off for load tests (k6 from one
    // IP) - refused by validateEnv in production.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 120 }],
      skipIf: () => process.env.THROTTLE_DISABLED === 'true' && process.env.NODE_ENV !== 'production',
    }),
    // Cron jobs: stale-order sweep, refresh-token janitor.
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    RedisModule,
    ObservabilityModule,
    FirebaseModule,
    SmsModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    ShopsModule,
    CategoriesModule,
    CartModule,
    OrdersModule,
    SellerModule,
    AdminModule,
    PaymentsModule,
    NotificationsModule,
    UploadsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Order matters: both read req.user, which JwtAuthGuard populates.
    // A temporary-password account may only change its password / log out / read /me.
    {
      provide: APP_GUARD,
      useClass: MustChangePasswordGuard,
    },
    // @Roles() is honoured on every controller; routes without it pass through.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
