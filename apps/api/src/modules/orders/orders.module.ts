import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersEscalationService } from './orders-escalation.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersEscalationService],
  exports: [OrdersService],
})
export class OrdersModule {}
