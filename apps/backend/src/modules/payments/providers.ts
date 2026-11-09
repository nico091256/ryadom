import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
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
    const merchantId = process.env.PAYME_MERCHANT_ID;
    const redirectUrl = merchantId
      ? `https://checkout.paycom.uz/${Buffer.from(`m=${merchantId};ac.order_id=${orderId};a=${amountTiyin}`).toString('base64')}`
      : `https://checkout.paycom.uz/checkout?order=${orderId}`;

    return {
      paymentId: `payme_${orderId}`,
      redirectUrl,
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  async handleWebhook(
    payload: Record<string, any>,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<PaymentCallbackResult> {
    const secretKey = process.env.PAYME_SECRET_KEY;
    if (!secretKey) {
      throw new UnauthorizedException({
        code: 'PAYME_SECRET_NOT_CONFIGURED',
        message: 'Payme webhook secret is not configured',
      });
    }

    const authHeaderRaw = headers?.authorization || headers?.Authorization;
    const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw || '';
    const expected = `Basic ${Buffer.from(`Paycom:${secretKey}`).toString('base64')}`;
    const a = Buffer.from(authHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({
        code: 'INVALID_PAYME_SIGNATURE',
        message: 'Invalid Payme authorization header',
      });
    }

    const method = payload?.method;
    if (method && method !== 'PerformTransaction' && method !== 'CancelTransaction') {
      throw new BadRequestException({
        code: 'UNSUPPORTED_PAYME_METHOD',
        message: `Unsupported Payme webhook method: ${method}`,
      });
    }

    const orderId = payload?.params?.account?.order_id || payload?.orderId;
    if (!orderId || typeof orderId !== 'string') {
      throw new BadRequestException({
        code: 'MISSING_ORDER_ID',
        message: 'Order ID is required in Payme webhook payload',
      });
    }

    const rawAmount = payload?.params?.amount;
    const amountTiyin = rawAmount !== undefined && rawAmount !== null ? Number(rawAmount) : undefined;
    if (amountTiyin !== undefined && (!Number.isFinite(amountTiyin) || amountTiyin <= 0)) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_AMOUNT',
        message: 'Invalid payment amount in Payme webhook payload',
      });
    }

    // Never log the raw payload: it carries account details and card/transaction data.
    this.logger.log(`[Payme Webhook] id=${payload.id ?? '-'} method=${method ?? '-'} state=${payload.params?.state ?? '-'}`);
    const isCancelled = method === 'CancelTransaction' || payload.params?.state < 0;
    return {
      success: !isCancelled,
      orderId,
      amountTiyin,
      paymentStatus: isCancelled ? PaymentStatus.FAILED : PaymentStatus.PAID,
      rawResponse: { result: { state: isCancelled ? -1 : 2 } },
    };
  }
}

@Injectable()
export class ClickPaymentProvider implements IPaymentProvider {
  readonly providerName = 'click';
  private readonly logger = new Logger(ClickPaymentProvider.name);

  async initializePayment(orderId: string, amountTiyin: number): Promise<PaymentInitializationResult> {
    this.logger.log(`[Click] Initializing payment for order ${orderId}, amount: ${amountTiyin} tiyin`);
    const serviceId = process.env.CLICK_SERVICE_ID || 'localshop';
    const merchantId = process.env.CLICK_MERCHANT_ID || '';
    const amountSom = (amountTiyin / 100).toFixed(2);
    const redirectUrl = merchantId
      ? `https://my.click.uz/services/pay?service_id=${encodeURIComponent(serviceId)}&merchant_id=${encodeURIComponent(merchantId)}&amount=${amountSom}&transaction_param=${encodeURIComponent(orderId)}`
      : `https://my.click.uz/services/pay?service_id=${encodeURIComponent(serviceId)}&order_id=${encodeURIComponent(orderId)}`;

    return {
      paymentId: `click_${orderId}`,
      redirectUrl,
      paymentStatus: PaymentStatus.PENDING,
    };
  }

  async handleWebhook(payload: Record<string, any>): Promise<PaymentCallbackResult> {
    const secretKey = process.env.CLICK_SECRET_KEY;
    if (!secretKey) {
      throw new UnauthorizedException({
        code: 'CLICK_SECRET_NOT_CONFIGURED',
        message: 'Click webhook secret is not configured',
      });
    }

    const signSource = `${payload.click_trans_id ?? ''}${payload.service_id ?? ''}${secretKey}${payload.merchant_trans_id ?? ''}${payload.merchant_prepare_id ?? ''}${payload.amount ?? ''}${payload.action ?? ''}${payload.sign_time ?? ''}`;
    const expectedSign = createHash('md5').update(signSource).digest('hex');
    const providedSign = String(payload.sign_string || '');
    const a = Buffer.from(providedSign);
    const b = Buffer.from(expectedSign);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({
        code: 'INVALID_CLICK_SIGNATURE',
        message: 'Invalid Click sign_string signature',
      });
    }

    const orderId = payload?.merchant_trans_id;
    if (!orderId || typeof orderId !== 'string') {
      throw new BadRequestException({
        code: 'MISSING_ORDER_ID',
        message: 'merchant_trans_id is required in Click webhook payload',
      });
    }

    const rawAmountSom = payload?.amount !== undefined && payload?.amount !== null ? Number(payload.amount) : undefined;
    if (rawAmountSom !== undefined && (!Number.isFinite(rawAmountSom) || rawAmountSom <= 0)) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_AMOUNT',
        message: 'Invalid payment amount in Click webhook payload',
      });
    }
    const amountTiyin = rawAmountSom !== undefined ? Math.round(rawAmountSom * 100) : undefined;

    // Never log the raw payload: it carries account details and card/transaction data.
    this.logger.log(`[Click Webhook] merchant_trans_id=${orderId} action=${payload.action ?? '-'} error=${payload.error ?? '-'}`);
    const hasError = Number(payload.error || 0) < 0;
    return {
      success: !hasError,
      orderId,
      amountTiyin,
      paymentStatus: hasError ? PaymentStatus.FAILED : PaymentStatus.PAID,
      rawResponse: { error: hasError ? Number(payload.error) : 0, error_note: hasError ? 'Failed' : 'Success' },
    };
  }
}
