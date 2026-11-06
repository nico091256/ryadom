import { Body, Controller, Headers, Module, Param, Post } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CashPaymentProvider, PaymePaymentProvider, ClickPaymentProvider } from './providers';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('webhook/:provider')
  @ApiOperation({ summary: 'Receive payment provider webhook (payme / click)' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: Record<string, any>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.paymentsService.handleWebhook(provider, payload, headers);
  }
}

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, CashPaymentProvider, PaymePaymentProvider, ClickPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
