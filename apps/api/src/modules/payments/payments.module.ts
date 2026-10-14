import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { CashPaymentProvider, PaymePaymentProvider, ClickPaymentProvider } from './providers';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [PaymentsService, CashPaymentProvider, PaymePaymentProvider, ClickPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
