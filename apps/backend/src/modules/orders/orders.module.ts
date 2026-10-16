import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderAutoCancelProcessor } from './order-auto-cancel.processor';
import { ORDER_AUTO_CANCEL_QUEUE } from './orders.constants';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    PaymentsModule,
    IdempotencyModule,
    BullModule.registerQueue({ name: ORDER_AUTO_CANCEL_QUEUE }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderAutoCancelProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
