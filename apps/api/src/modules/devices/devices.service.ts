import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDeviceDto } from './devices.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Upserts a device's FCM token for the user, enabling multi-device push
   * (one row per physical device instead of a single overwritten column).
   */
  async register(userId: string, dto: RegisterDeviceDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { user_id: userId, platform: dto.platform },
      create: { user_id: userId, token: dto.token, platform: dto.platform },
    });
    return { success: true };
  }

  async unregister(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { user_id: userId, token } });
    return { success: true };
  }
}
