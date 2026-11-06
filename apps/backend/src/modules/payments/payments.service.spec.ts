import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@localshop/shared';
import { PaymentsService } from './payments.service';
import { CashPaymentProvider, ClickPaymentProvider, PaymePaymentProvider } from './providers';

describe('PaymentsService & Providers', () => {
  const originalEnv = process.env;

  let prisma: {
    order: { findUnique: jest.Mock; updateMany: jest.Mock };
    payment: { create: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock };
  };
  let configValues: Record<string, string>;
  let configService: ConfigService;
  let cashProvider: CashPaymentProvider;
  let paymeProvider: PaymePaymentProvider;
  let clickProvider: ClickPaymentProvider;
  let service: PaymentsService;

  const paymeAuthHeader = (secret: string) => ({
    authorization: `Basic ${Buffer.from(`Paycom:${secret}`).toString('base64')}`,
  });

  const clickSign = (params: {
    click_trans_id: string | number;
    service_id: string | number;
    secret: string;
    merchant_trans_id: string;
    merchant_prepare_id?: string;
    amount: string | number;
    action: number;
    sign_time: string;
  }) => {
    const prep = params.action === 1 ? (params.merchant_prepare_id ?? '') : '';
    const src = `${params.click_trans_id}${params.service_id}${params.secret}${params.merchant_trans_id}${prep}${params.amount}${params.action}${params.sign_time}`;
    return createHash('md5').update(src).digest('hex');
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PAYME_SECRET_KEY: 'test_payme_secret',
      CLICK_SECRET_KEY: 'test_click_secret',
    };

    configValues = {
      ONLINE_PAYMENTS_ENABLED: 'true',
    };
    configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;

    prisma = {
      order: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    cashProvider = new CashPaymentProvider();
    paymeProvider = new PaymePaymentProvider();
    clickProvider = new ClickPaymentProvider();
    service = new PaymentsService(configService, prisma as any, cashProvider, paymeProvider, clickProvider);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Security & Configuration Guards', () => {
    it('rejects webhooks when ONLINE_PAYMENTS_ENABLED is false', async () => {
      configValues.ONLINE_PAYMENTS_ENABLED = 'false';

      await expect(
        service.handleWebhook(
          'payme',
          { method: 'PerformTransaction', params: { id: 'tx_1', account: { order_id: 'ord_1' } } },
          paymeAuthHeader('test_payme_secret'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects Payme webhook when PAYME_SECRET_KEY is not configured', async () => {
      delete process.env.PAYME_SECRET_KEY;

      await expect(
        service.handleWebhook('payme', {
          method: 'PerformTransaction',
          params: { id: 'tx_1', account: { order_id: 'ord_1' } },
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects Payme webhook with invalid Basic authorization header', async () => {
      await expect(
        service.handleWebhook(
          'payme',
          { method: 'PerformTransaction', params: { id: 'tx_1', account: { order_id: 'ord_1' } } },
          paymeAuthHeader('wrong_secret'),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects Click webhook when CLICK_SECRET_KEY is not configured', async () => {
      delete process.env.CLICK_SECRET_KEY;

      await expect(
        service.handleWebhook('click', {
          click_trans_id: '100',
          service_id: '1',
          merchant_trans_id: 'ord_1',
          amount: '15000.00',
          action: 1,
          sign_time: '2026-01-01 12:00:00',
          sign_string: 'anything',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects bare {"orderId": "..."} payload without valid Payme JSON-RPC method', async () => {
      await expect(
        service.handleWebhook('payme', { orderId: 'ord_1' }, paymeAuthHeader('test_payme_secret')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Payme Webhook Lifecycle & Validations', () => {
    const baseOrder = {
      id: 'ord_1',
      status: OrderStatus.NEW,
      payment_method: PaymentMethod.ONLINE,
      payment_status: PaymentStatus.PENDING,
      total_amount: 1500000, // 15,000 UZS in tiyin
    };

    it('CheckPerformTransaction validates amount and does NOT mark order as PAID', async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay_1', order_id: 'ord_1', provider_tx_id: null });

      const res = await service.handleWebhook(
        'payme',
        {
          id: 1,
          method: 'CheckPerformTransaction',
          params: { amount: 1500000, account: { order_id: 'ord_1' } },
        },
        paymeAuthHeader('test_payme_secret'),
      );

      expect(res).toEqual({ result: { allow: true } });
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('CreateTransaction binds provider_tx_id and keeps status PENDING', async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay_1', order_id: 'ord_1', provider_tx_id: null });

      const res = await service.handleWebhook(
        'payme',
        {
          id: 2,
          method: 'CreateTransaction',
          params: { id: 'payme_tx_99', amount: 1500000, account: { order_id: 'ord_1' } },
        },
        paymeAuthHeader('test_payme_secret'),
      );

      expect(res.result.state).toBe(1);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { order_id: 'ord_1', provider: 'payme' },
        data: { provider_tx_id: 'payme_tx_99' },
      });
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects webhook when amount does not match order total_amount', async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay_1', order_id: 'ord_1', provider_tx_id: null });

      await expect(
        service.handleWebhook(
          'payme',
          {
            id: 3,
            method: 'CheckPerformTransaction',
            params: { amount: 10000, account: { order_id: 'ord_1' } },
          },
          paymeAuthHeader('test_payme_secret'),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects payment on a cancelled order', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, status: OrderStatus.CANCELLED });
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay_1', order_id: 'ord_1', provider_tx_id: 'payme_tx_99' });

      await expect(
        service.handleWebhook(
          'payme',
          {
            id: 4,
            method: 'PerformTransaction',
            params: { id: 'payme_tx_99', account: { order_id: 'ord_1' } },
          },
          paymeAuthHeader('test_payme_secret'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('PerformTransaction transitions order and payment to PAID (including lookup by provider_tx_id)', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay_1',
        order_id: 'ord_1',
        provider: 'payme',
        provider_tx_id: 'payme_tx_99',
      });
      prisma.order.findUnique.mockResolvedValue(baseOrder);

      const res = await service.handleWebhook(
        'payme',
        {
          id: 5,
          method: 'PerformTransaction',
          params: { id: 'payme_tx_99' },
        },
        paymeAuthHeader('test_payme_secret'),
      );

      expect(res.result.state).toBe(2);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { order_id: 'ord_1', provider: 'payme' },
        data: { status: PaymentStatus.PAID, provider_tx_id: 'payme_tx_99' },
      });
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'ord_1' },
        data: { payment_status: PaymentStatus.PAID },
      });
    });

    it('CancelTransaction marks already PAID order as REFUNDED with state -2', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, payment_status: PaymentStatus.PAID });
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay_1',
        order_id: 'ord_1',
        provider: 'payme',
        provider_tx_id: 'payme_tx_99',
      });

      const res = await service.handleWebhook(
        'payme',
        {
          id: 6,
          method: 'CancelTransaction',
          params: { id: 'payme_tx_99', account: { order_id: 'ord_1' }, reason: 5 },
        },
        paymeAuthHeader('test_payme_secret'),
      );

      expect(res.result.state).toBe(-2);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'ord_1' },
        data: { payment_status: PaymentStatus.REFUNDED },
      });
    });
  });

  describe('Click Webhook Lifecycle & Validations', () => {
    const baseOrder = {
      id: 'ord_2',
      status: OrderStatus.NEW,
      payment_method: PaymentMethod.ONLINE,
      payment_status: PaymentStatus.PENDING,
      total_amount: 2500000, // 25,000 UZS in tiyin
    };

    it('Prepare (action=0) validates amount and keeps status PENDING', async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay_2', order_id: 'ord_2', provider_tx_id: null });

      const payload = {
        click_trans_id: '777',
        service_id: '10',
        merchant_trans_id: 'ord_2',
        amount: '25000.00',
        action: 0,
        sign_time: '2026-05-01 10:00:00',
      };
      const sign_string = clickSign({ ...payload, secret: 'test_click_secret' });

      const res = await service.handleWebhook('click', { ...payload, sign_string });

      expect(res.error).toBe(0);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { order_id: 'ord_2', provider: 'click' },
        data: { provider_tx_id: '777' },
      });
    });

    it('Complete (action=1) marks order and payment as PAID when amount matches', async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay_2', order_id: 'ord_2', provider_tx_id: '777' });

      const payload = {
        click_trans_id: '777',
        service_id: '10',
        merchant_trans_id: 'ord_2',
        merchant_prepare_id: 'ord_2',
        amount: '25000.00',
        action: 1,
        sign_time: '2026-05-01 10:01:00',
      };
      const sign_string = clickSign({ ...payload, secret: 'test_click_secret' });

      const res = await service.handleWebhook('click', { ...payload, sign_string });

      expect(res.error).toBe(0);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'ord_2' },
        data: { payment_status: PaymentStatus.PAID },
      });
    });

    it('throws NotFoundException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      const payload = {
        click_trans_id: '777',
        service_id: '10',
        merchant_trans_id: 'unknown_order',
        amount: '25000.00',
        action: 0,
        sign_time: '2026-05-01 10:00:00',
      };
      const sign_string = clickSign({ ...payload, secret: 'test_click_secret' });

      await expect(service.handleWebhook('click', { ...payload, sign_string })).rejects.toThrow(NotFoundException);
    });
  });
});
