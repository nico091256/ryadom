import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  let prisma: any;
  let service: DevicesService;

  beforeEach(() => {
    prisma = {
      deviceToken: { upsert: jest.fn(), deleteMany: jest.fn() },
    };
    service = new DevicesService(prisma);
  });

  it('upserts a device token by its token value, enabling multi-device registration', async () => {
    await service.register('user-1', { token: 'tok-abc', platform: 'android' } as any);

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
      where: { token: 'tok-abc' },
      update: { user_id: 'user-1', platform: 'android' },
      create: { user_id: 'user-1', token: 'tok-abc', platform: 'android' },
    });
  });

  it('only removes the token belonging to the requesting user', async () => {
    await service.unregister('user-1', 'tok-abc');

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', token: 'tok-abc' },
    });
  });
});
