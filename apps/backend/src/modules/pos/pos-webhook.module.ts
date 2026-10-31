import { Module } from '@nestjs/common';
import { PosWebhookService } from './pos-webhook.service';

/**
 * Stand-alone so OrdersModule can import it without a cycle:
 * OrdersModule -> PosWebhookModule, and PosModule -> OrdersModule.
 */
@Module({
  providers: [PosWebhookService],
  exports: [PosWebhookService],
})
export class PosWebhookModule {}
