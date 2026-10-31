import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { PosApiKeyGuard } from './pos-api-key.guard';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PosWebhookModule } from './pos-webhook.module';

@Module({
  imports: [PrismaModule, OrdersModule, PosWebhookModule],
  controllers: [PosController],
  providers: [PosService, PosApiKeyGuard],
})
export class PosModule {}
