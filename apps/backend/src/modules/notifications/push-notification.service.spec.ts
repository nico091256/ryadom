import { Logger } from '@nestjs/common';
import { OrderStatus } from '@localshop/shared';
import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService — never rejects', () => {
  let prisma: any;
  let firebase: any;
  let service: PushNotificationService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ language: 'uz' }) },
      deviceToken: {
        findMany: jest.fn().mockResolvedValue([{ id: 'd1', token: 't1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    firebase = { messaging: { sendEachForMulticast: jest.fn() } };
    service = new PushNotificationService(prisma, firebase);
  });

  afterEach(() => jest.restoreAllMocks());

  it('sendOrderStatusPush resolves (and logs) when the user lookup throws', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.sendOrderStatusPush('u1', OrderStatus.ACCEPTED, 'o1')).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });

  it('sendNewOrderSellerPush resolves when FCM rejects', async () => {
    firebase.messaging.sendEachForMulticast.mockRejectedValue(new Error('fcm unavailable'));
    await expect(service.sendNewOrderSellerPush('seller', 'o1', "10 000 so'm")).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('fcm unavailable'));
  });

  it('prunes tokens FCM reports as unregistered and keeps the rest', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([
      { id: 'stale', token: 't-stale' },
      { id: 'ok', token: 't-ok' },
    ]);
    firebase.messaging.sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: true },
      ],
    });

    await service.sendOrderStatusPush('u1', OrderStatus.DELIVERED, 'o1');

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['stale'] } } });
  });

  it('is a no-op (no DB reads) when Firebase is not configured', async () => {
    firebase.messaging = null;
    await service.sendOrderStatusPush('u1', OrderStatus.NEW, 'o1');
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
  });
});
