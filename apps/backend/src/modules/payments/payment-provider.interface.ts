import { PaymentStatus } from '@localshop/shared';

export interface PaymentInitializationResult {
  paymentId: string;
  redirectUrl?: string;
  paymentStatus: PaymentStatus;
}

export interface PaymentCallbackResult {
  success: boolean;
  orderId: string;
  amountTiyin?: number;
  paymentStatus: PaymentStatus;
  rawResponse: Record<string, any>;
}

export interface IPaymentProvider {
  readonly providerName: string;

  initializePayment(orderId: string, amountTiyin: number, customerPhone: string): Promise<PaymentInitializationResult>;

  handleWebhook(
    payload: Record<string, any>,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<PaymentCallbackResult>;
}
