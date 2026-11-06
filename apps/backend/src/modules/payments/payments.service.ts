import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@localshop/shared';
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

    let orderId = result.orderId;
    const existingPaymentByTx =
      !orderId && result.providerTxId
        ? await this.prisma.payment.findFirst({
            where: { provider: providerName, provider_tx_id: result.providerTxId },
          })
        : null;

    if (!orderId && existingPaymentByTx) {
      orderId = existingPaymentByTx.order_id;
    }

    if (!orderId) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order or payment transaction not found.',
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.',
      });
    }

    if (order.payment_method !== PaymentMethod.ONLINE) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_METHOD',
        message: 'Order does not use online payment.',
      });
    }

    if (result.amountTiyin !== undefined && result.amountTiyin !== order.total_amount) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_AMOUNT',
        message: `Payment amount (${result.amountTiyin}) does not match order total (${order.total_amount}).`,
      });
    }

    const existingPayment =
      existingPaymentByTx ??
      (await this.prisma.payment.findFirst({
        where: { order_id: orderId, provider: providerName },
      }));

    if (
      existingPayment?.provider_tx_id &&
      result.providerTxId &&
      existingPayment.provider_tx_id !== result.providerTxId
    ) {
      throw new BadRequestException({
        code: 'TRANSACTION_MISMATCH',
        message: 'Another transaction is already bound to this order.',
      });
    }

    if (result.action === 'check' || result.action === 'prepare') {
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException({
          code: 'ORDER_CANCELLED',
          message: 'Cannot process payment for a cancelled order.',
        });
      }
      if (order.payment_status !== PaymentStatus.PENDING) {
        throw new BadRequestException({
          code: 'PAYMENT_NOT_PENDING',
          message: `Order payment is already ${order.payment_status}.`,
        });
      }
      if (result.action === 'prepare' && result.providerTxId) {
        await this.prisma.payment.updateMany({
          where: { order_id: orderId, provider: providerName },
          data: { provider_tx_id: result.providerTxId },
        });
      }
      return result.rawResponse;
    }

    if (result.action === 'perform') {
      if (order.payment_status === PaymentStatus.PAID) {
        return result.rawResponse;
      }
      if (order.status === OrderStatus.CANCELLED || order.payment_status !== PaymentStatus.PENDING) {
        throw new BadRequestException({
          code: 'INVALID_PAYMENT_STATE',
          message: 'Order is not eligible for payment completion.',
        });
      }

      await this.prisma.payment.updateMany({
        where: { order_id: orderId, provider: providerName },
        data: {
          status: PaymentStatus.PAID as any,
          ...(result.providerTxId ? { provider_tx_id: result.providerTxId } : {}),
        },
      });

      await this.prisma.order.updateMany({
        where: { id: orderId },
        data: { payment_status: PaymentStatus.PAID as any },
      });

      return result.rawResponse;
    }

    // result.action === 'cancel'
    const nextCancelStatus =
      order.payment_status === PaymentStatus.PAID ? PaymentStatus.REFUNDED : PaymentStatus.FAILED;

    await this.prisma.payment.updateMany({
      where: { order_id: orderId, provider: providerName },
      data: {
        status: nextCancelStatus as any,
        ...(result.providerTxId ? { provider_tx_id: result.providerTxId } : {}),
      },
    });

    await this.prisma.order.updateMany({
      where: { id: orderId },
      data: { payment_status: nextCancelStatus as any },
    });

    if (providerName === 'payme' && nextCancelStatus === PaymentStatus.REFUNDED && result.rawResponse?.result) {
      return {
        ...result.rawResponse,
        result: { ...result.rawResponse.result, state: -2 },
      };
    }

    return result.rawResponse;
  }
}
