import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@localshop/shared';
import { IPaymentProvider, PaymentCallbackResult, PaymentInitializationResult } from './payment-provider.interface';

@Injectable()
export class CashPaymentProvider implements IPaymentProvider {
  readonly providerName = 'cash';

  async initializePayment(orderId: string, amountTiyin: number): Promise<PaymentInitializationResult> {
    return {
      paymentId: `cash_${orderId}`,
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  async handleWebhook(): Promise<PaymentCallbackResult> {
    throw new Error('Cash payments do not use server webhooks');
  }
}

@Injectable()
export class PaymePaymentProvider implements IPaymentProvider {
  readonly providerName = 'payme';
  private readonly logger = new Logger(PaymePaymentProvider.name);

  async initializePayment(orderId: string, amountTiyin: number): Promise<PaymentInitializationResult> {
    this.logger.log(`[Payme] Initializing payment for order ${orderId}, amount: ${amountTiyin} tiyin`);
    return {
      paymentId: `payme_${orderId}`,
      redirectUrl: `https://checkout.paycom.uz/checkout?order=${orderId}`,
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  async handleWebhook(payload: Record<string, any>): Promise<PaymentCallbackResult> {
    // Never log the raw payload: it carries account details and card/transaction data.
    this.logger.log(`[Payme Webhook] id=${payload.id ?? '-'} method=${payload.method ?? '-'} state=${payload.params?.state ?? '-'}`);
    return {
      success: true,
      orderId: payload.params?.account?.order_id || payload.orderId,
      paymentStatus: PaymentStatus.PAID,
      rawResponse: { result: { state: 2 } },
    };
  }
}

@Injectable()
export class ClickPaymentProvider implements IPaymentProvider {
  readonly providerName = 'click';
  private readonly logger = new Logger(ClickPaymentProvider.name);

  async initializePayment(orderId: string, amountTiyin: number): Promise<PaymentInitializationResult> {
    this.logger.log(`[Click] Initializing payment for order ${orderId}, amount: ${amountTiyin} tiyin`);
    return {
      paymentId: `click_${orderId}`,
      redirectUrl: `https://my.click.uz/services/pay?service_id=localshop&order_id=${orderId}`,
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  async handleWebhook(payload: Record<string, any>): Promise<PaymentCallbackResult> {
    // Never log the raw payload: it carries account details and card/transaction data.
    this.logger.log(`[Click Webhook] merchant_trans_id=${payload.merchant_trans_id ?? '-'} action=${payload.action ?? '-'} error=${payload.error ?? '-'}`);
    return {
      success: true,
      orderId: payload.merchant_trans_id,
      paymentStatus: PaymentStatus.PAID,
      rawResponse: { error: 0, error_note: 'Success' },
    };
  }
}
