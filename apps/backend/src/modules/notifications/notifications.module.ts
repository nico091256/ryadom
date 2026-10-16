import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationService } from './push-notification.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [JwtModule, ConfigModule, PrismaModule],
  providers: [NotificationsGateway, PushNotificationService],
  exports: [NotificationsGateway, PushNotificationService],
})
export class NotificationsModule {}
