import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { PaymentStatus } from '@localshop/shared';
import { IPaymentProvider, PaymentCallbackResult, PaymentInitializationResult } from './payment-provider.interface';

const PAYME_METHODS = new Set([
  'CheckPerformTransaction',
  'CreateTransaction',
  'PerformTransaction',
  'CancelTransaction',
  'CheckTransaction',
]);

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
    const secretKey = process.env.PAYME_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new UnauthorizedException({
        code: 'INVALID_PAYME_SIGNATURE',
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

    const method = typeof payload?.method === 'string' ? payload.method : '';
    if (!PAYME_METHODS.has(method)) {
      throw new BadRequestException({
        code: 'INVALID_PAYME_METHOD',
        message: 'Unsupported or missing Payme JSON-RPC method',
      });
    }

    const params = payload.params && typeof payload.params === 'object' ? payload.params : {};
    const orderId = typeof params.account?.order_id === 'string' ? params.account.order_id.trim() : undefined;
    const providerTxId = params.id !== undefined && params.id !== null ? String(params.id).trim() : undefined;
    const rawAmount = params.amount !== undefined ? Number(params.amount) : undefined;
    const amountTiyin =
      rawAmount !== undefined && Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount) : undefined;

    // Never log the raw payload: it carries account details and card/transaction data.
    this.logger.log(`[Payme Webhook] id=${payload.id ?? '-'} method=${method} tx=${providerTxId ?? '-'}`);

    if (method === 'CheckPerformTransaction') {
      if (!orderId || amountTiyin === undefined) {
        throw new BadRequestException({
          code: 'INVALID_PAYME_PARAMS',
          message: 'CheckPerformTransaction requires account.order_id and positive amount',
        });
      }
      return {
        success: true,
        action: 'check',
        orderId,
        amountTiyin,
        shouldUpdateStatus: false,
        paymentStatus: PaymentStatus.PENDING,
        rawResponse: { result: { allow: true } },
      };
    }

    if (method === 'CreateTransaction') {
      if (!orderId || !providerTxId || amountTiyin === undefined) {
        throw new BadRequestException({
          code: 'INVALID_PAYME_PARAMS',
          message: 'CreateTransaction requires id, account.order_id, and positive amount',
        });
      }
      return {
        success: true,
        action: 'prepare',
        orderId,
        providerTxId,
        amountTiyin,
        shouldUpdateStatus: false,
        paymentStatus: PaymentStatus.PENDING,
        rawResponse: {
          result: {
            create_time: Date.now(),
            transaction: providerTxId,
            state: 1,
          },
        },
      };
    }

    if (method === 'CheckTransaction') {
      if (!providerTxId && !orderId) {
        throw new BadRequestException({
          code: 'INVALID_PAYME_PARAMS',
          message: 'CheckTransaction requires transaction id or account.order_id',
        });
      }
      return {
        success: true,
        action: 'check',
        orderId,
        providerTxId,
        shouldUpdateStatus: false,
        paymentStatus: PaymentStatus.PENDING,
        rawResponse: {
          result: {
            transaction: providerTxId || orderId,
            state: 1,
          },
        },
      };
    }

    if (method === 'PerformTransaction') {
      if (!providerTxId && !orderId) {
        throw new BadRequestException({
          code: 'INVALID_PAYME_PARAMS',
          message: 'PerformTransaction requires transaction id or account.order_id',
        });
      }
      return {
        success: true,
        action: 'perform',
        orderId,
        providerTxId,
        amountTiyin,
        shouldUpdateStatus: true,
        paymentStatus: PaymentStatus.PAID,
        rawResponse: {
          result: {
            transaction: providerTxId || orderId,
            perform_time: Date.now(),
            state: 2,
          },
        },
      };
    }

    // CancelTransaction
    if (!providerTxId && !orderId) {
      throw new BadRequestException({
        code: 'INVALID_PAYME_PARAMS',
        message: 'CancelTransaction requires transaction id or account.order_id',
      });
    }
    return {
      success: false,
      action: 'cancel',
      orderId,
      providerTxId,
      shouldUpdateStatus: true,
      paymentStatus: PaymentStatus.FAILED,
      rawResponse: {
        result: {
          transaction: providerTxId || orderId,
          cancel_time: Date.now(),
          state: -1,
        },
      },
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
    const secretKey = process.env.CLICK_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new UnauthorizedException({
        code: 'INVALID_CLICK_SIGNATURE',
        message: 'Click webhook secret is not configured',
      });
    }

    const action = Number(payload?.action);
    if (action !== 0 && action !== 1) {
      throw new BadRequestException({
        code: 'INVALID_CLICK_ACTION',
        message: 'Click action must be 0 (Prepare) or 1 (Complete)',
      });
    }

    const prepareIdPart = action === 1 ? (payload.merchant_prepare_id ?? '') : '';
    const signSource = `${payload.click_trans_id ?? ''}${payload.service_id ?? ''}${secretKey}${payload.merchant_trans_id ?? ''}${prepareIdPart}${payload.amount ?? ''}${payload.action ?? ''}${payload.sign_time ?? ''}`;
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

    const orderId = typeof payload.merchant_trans_id === 'string' ? payload.merchant_trans_id.trim() : String(payload.merchant_trans_id ?? '').trim();
    if (!orderId) {
      throw new BadRequestException({
        code: 'INVALID_CLICK_PARAMS',
        message: 'Click merchant_trans_id is required',
      });
    }

    const amountSom = Number(payload.amount);
    if (!Number.isFinite(amountSom) || amountSom <= 0) {
      throw new BadRequestException({
        code: 'INVALID_CLICK_PARAMS',
        message: 'Click amount must be a positive number',
      });
    }
    const amountTiyin = Math.round(amountSom * 100);
    const providerTxId =
      payload.click_trans_id !== undefined && payload.click_trans_id !== null
        ? String(payload.click_trans_id).trim()
        : undefined;

    // Never log the raw payload: it carries account details and card/transaction data.
    this.logger.log(`[Click Webhook] merchant_trans_id=${orderId} action=${action} error=${payload.error ?? '-'}`);
    const hasError = Number(payload.error || 0) < 0;

    if (hasError) {
      return {
        success: false,
        action: 'cancel',
        orderId,
        providerTxId,
        amountTiyin,
        shouldUpdateStatus: true,
        paymentStatus: PaymentStatus.FAILED,
        rawResponse: { error: Number(payload.error), error_note: 'Failed' },
      };
    }

    if (action === 0) {
      return {
        success: true,
        action: 'prepare',
        orderId,
        providerTxId,
        amountTiyin,
        shouldUpdateStatus: false,
        paymentStatus: PaymentStatus.PENDING,
        rawResponse: {
          click_trans_id: payload.click_trans_id,
          merchant_trans_id: orderId,
          merchant_prepare_id: orderId,
          error: 0,
          error_note: 'Success',
        },
      };
    }

    return {
      success: true,
      action: 'perform',
      orderId,
      providerTxId,
      amountTiyin,
      shouldUpdateStatus: true,
      paymentStatus: PaymentStatus.PAID,
      rawResponse: {
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: orderId,
        merchant_confirm_id: orderId,
        error: 0,
        error_note: 'Success',
      },
    };
  }
}
