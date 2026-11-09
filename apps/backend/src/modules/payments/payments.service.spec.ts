import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PaymentStatus } from '@localshop/shared';
import { CashPaymentProvider, ClickPaymentProvider, PaymePaymentProvider } from './providers';
import { PaymentsService } from './payments.service';

describe('PaymentsService & Providers webhook security', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('PaymePaymentProvider.handleWebhook', () => {
    const provider = new PaymePaymentProvider();

    it('rejects when PAYME_SECRET_KEY is not configured', async () => {
      delete process.env.PAYME_SECRET_KEY;
      await expect(
        provider.handleWebhook({ method: 'PerformTransaction', params: { account: { order_id: 'o-1' }, amount: 150000 } }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when Basic authorization header is missing or invalid', async () => {
      process.env.PAYME_SECRET_KEY = 'super-secret-payme-key';
      await expect(
        provider.handleWebhook(
          { method: 'PerformTransaction', params: { account: { order_id: 'o-1' }, amount: 150000 } },
          { authorization: 'Basic d3Jvbmc6a2V5' },
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects non-settlement methods such as CheckPerformTransaction', async () => {
      process.env.PAYME_SECRET_KEY = 'super-secret-payme-key';
      const auth = `Basic ${Buffer.from('Paycom:super-secret-payme-key').toString('base64')}`;
      await expect(
        provider.handleWebhook(
          { method: 'CheckPerformTransaction', params: { account: { order_id: 'o-1' }, amount: 150000 } },
          { authorization: auth },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid PerformTransaction webhook and extracts amountTiyin', async () => {
      process.env.PAYME_SECRET_KEY = 'super-secret-payme-key';
      const auth = `Basic ${Buffer.from('Paycom:super-secret-payme-key').toString('base64')}`;
      const res = await provider.handleWebhook(
        { method: 'PerformTransaction', params: { account: { order_id: 'o-1' }, amount: 250000 } },
        { authorization: auth },
      );
      expect(res).toEqual({
        success: true,
        orderId: 'o-1',
        amountTiyin: 250000,
        paymentStatus: PaymentStatus.PAID,
        rawResponse: { result: { state: 2 } },
      });
    });
  });

  describe('ClickPaymentProvider.handleWebhook', () => {
    const provider = new ClickPaymentProvider();

    it('rejects when CLICK_SECRET_KEY is not configured', async () => {
      delete process.env.CLICK_SECRET_KEY;
      await expect(provider.handleWebhook({ merchant_trans_id: 'o-1', amount: '2500.00' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('validates MD5 sign_string and converts som amount to tiyin', async () => {
      process.env.CLICK_SECRET_KEY = 'click-secret-123';
      const payload = {
        click_trans_id: '100',
        service_id: '200',
        merchant_trans_id: 'o-1',
        merchant_prepare_id: '300',
        amount: '2500.00',
        action: '1',
        sign_time: '2026-11-09 10:00:00',
        error: '0',
      };
      const signSource = `${payload.click_trans_id}${payload.service_id}click-secret-123${payload.merchant_trans_id}${payload.merchant_prepare_id}${payload.amount}${payload.action}${payload.sign_time}`;
      const sign_string = createHash('md5').update(signSource).digest('hex');

      const res = await provider.handleWebhook({ ...payload, sign_string });
      expect(res).toEqual({
        success: true,
        orderId: 'o-1',
        amountTiyin: 250000,
        paymentStatus: PaymentStatus.PAID,
        rawResponse: { error: 0, error_note: 'Success' },
      });
    });
  });

  describe('PaymentsService.handleWebhook', () => {
    let prisma: any;
    let configService: any;
    let service: PaymentsService;

    beforeEach(() => {
      process.env.PAYME_SECRET_KEY = 'payme-secret';
      prisma = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ id: 'o-1', total_amount: 250000 }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        payment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      configService = {
        get: jest.fn((key: string) => (key === 'ONLINE_PAYMENTS_ENABLED' ? 'true' : undefined)),
      };
      service = new PaymentsService(
        configService,
        prisma,
        new CashPaymentProvider(),
        new PaymePaymentProvider(),
        new ClickPaymentProvider(),
      );
    });

    it('rejects webhooks when ONLINE_PAYMENTS_ENABLED is false', async () => {
      configService.get.mockReturnValue('false');
      await expect(service.handleWebhook('payme', {}, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when paid amount does not match order.total_amount', async () => {
      const auth = `Basic ${Buffer.from('Paycom:payme-secret').toString('base64')}`;
      await expect(
        service.handleWebhook(
          'payme',
          { method: 'PerformTransaction', params: { account: { order_id: 'o-1' }, amount: 100 } },
          { authorization: auth },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('marks order and payment as PAID when signature and amount match', async () => {
      const auth = `Basic ${Buffer.from('Paycom:payme-secret').toString('base64')}`;
      const res = await service.handleWebhook(
        'payme',
        { method: 'PerformTransaction', params: { account: { order_id: 'o-1' }, amount: 250000 } },
        { authorization: auth },
      );
      expect(res).toEqual({ result: { state: 2 } });
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { order_id: 'o-1', provider: 'payme' },
        data: { status: PaymentStatus.PAID },
      });
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o-1' },
        data: { payment_status: PaymentStatus.PAID },
      });
    });
  });
});

