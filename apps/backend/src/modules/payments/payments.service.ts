import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus } from '@localshop/shared';
import { IPaymentProvider } from './payment-provider.interface';
import { CashPaymentProvider, PaymePaymentProvider, ClickPaymentProvider } from './providers';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private providers: Map<string, IPaymentProvider> = new Map();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private cashProvider: CashPaymentProvider,
    private paymeProvider: PaymePaymentProvider,
    private clickProvider: ClickPaymentProvider,
  ) {
    this.providers.set('cash', this.cashProvider);
    this.providers.set('payme', this.paymeProvider);
    this.providers.set('click', this.clickProvider);
  }

  get isOnlinePaymentsEnabled(): boolean {
    return this.configService.get<string>('ONLINE_PAYMENTS_ENABLED') === 'true';
  }

  /** Provider key written to `payments.provider` for `payment_method: 'online'` orders. */
  get onlineProviderKey(): string {
    return this.paymeProvider.providerName;
  }

  getProvider(providerName: string): IPaymentProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestException(`Payment provider '${providerName}' is not supported`);
    }
    return provider;
  }

  async processOrderPayment(orderId: string, method: PaymentMethod, amountTiyin: number, customerPhone: string) {
    if (method === PaymentMethod.ONLINE && !this.isOnlinePaymentsEnabled) {
      throw new BadRequestException({
        code: 'ONLINE_PAYMENTS_DISABLED',
        message: 'Online payments are currently disabled. Please select Cash on Delivery.',
      });
    }

    const providerKey = method === PaymentMethod.CASH ? 'cash' : 'payme';
    const provider = this.getProvider(providerKey);
    const result = await provider.initializePayment(orderId, amountTiyin, customerPhone);

    await this.prisma.payment.create({
      data: {
        order_id: orderId,
        provider: providerKey,
        amount: amountTiyin,
        status: result.paymentStatus as any,
      },
    });

    return result;
  }

  async handleWebhook(
    providerName: string,
    payload: Record<string, any>,
    headers?: Record<string, string | string[] | undefined>,
  ) {
    if (!this.isOnlinePaymentsEnabled) {
      throw new BadRequestException({
        code: 'ONLINE_PAYMENTS_DISABLED',
        message: 'Online payments are currently disabled.',
      });
    }

    const provider = this.getProvider(providerName);
    const result = await provider.handleWebhook(payload, headers);

    if (result.orderId) {
      if (this.prisma.order?.findUnique) {
        const order = await this.prisma.order.findUnique({
          where: { id: result.orderId },
          select: { id: true, total_amount: true },
        });
        if (!order) {
          throw new BadRequestException({
            code: 'ORDER_NOT_FOUND',
            message: 'Order referenced by payment webhook was not found.',
          });
        }
        if (
          result.paymentStatus === PaymentStatus.PAID &&
          result.amountTiyin !== undefined &&
          order.total_amount !== result.amountTiyin
        ) {
          throw new BadRequestException({
            code: 'PAYMENT_AMOUNT_MISMATCH',
            message: 'Paid amount does not match order total.',
          });
        }
      }

      await this.prisma.payment.updateMany({
        where: { order_id: result.orderId, provider: providerName },
        data: { status: result.paymentStatus as any },
      });

      await this.prisma.order.updateMany({
        where: { id: result.orderId },
        data: { payment_status: result.paymentStatus as any },
      });
    }

    return result.rawResponse;
  }
}
