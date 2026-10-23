import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, SupportedLanguage } from '@localshop/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FirebaseService } from '../../common/firebase/firebase.service';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
  priority?: 'high' | 'normal';
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
  ) {}

  /**
   * Callers fire-and-forget these (`this.push.sendX(...)` without await), so a
   * rejection here would surface as an unhandledRejection and crash the process.
   * Both public entry points therefore swallow every failure into a log line:
   * a lost push must never fail the order flow that triggered it.
   */
  async sendOrderStatusPush(userId: string, status: OrderStatus, orderId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { language: true },
      });
      if (!user) return;

      const lang = (user.language as SupportedLanguage) || SupportedLanguage.UZ;
      const { title, body } = this.getStatusPushMessage(status, lang);

      await this.sendToUser(userId, {
        title,
        body,
        data: { orderId, status },
        channelId: 'orders',
      });
    } catch (err: any) {
      this.logger.error(`Order status push failed (user ${userId}, order ${orderId}): ${err?.message ?? err}`);
    }
  }

  async sendNewOrderSellerPush(sellerUserId: string, orderId: string, totalAmountFormatted: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: sellerUserId },
        select: { language: true },
      });
      if (!user) return;

      const lang = (user.language as SupportedLanguage) || SupportedLanguage.UZ;
      const title = lang === 'ru' ? 'Новый заказ!' : lang === 'en' ? 'New Order!' : 'Yangi buyurtma!';
      const body = lang === 'ru'
        ? `Поступил новый заказ на ${totalAmountFormatted}. Примите в течение 10 минут!`
        : lang === 'en'
        ? `New order for ${totalAmountFormatted}. Please accept within 10 minutes!`
        : `Yangi buyurtma keldi (${totalAmountFormatted}). 10 daqiqa ichida qabul qiling!`;

      await this.sendToUser(sellerUserId, {
        title,
        body,
        data: { orderId, type: 'NEW_ORDER' },
        channelId: 'orders_high_importance',
        priority: 'high',
      });
    } catch (err: any) {
      this.logger.error(`New-order push failed (seller ${sellerUserId}, order ${orderId}): ${err?.message ?? err}`);
    }
  }

  private getStatusPushMessage(status: OrderStatus, lang: SupportedLanguage): { title: string; body: string } {
    const titles: Record<SupportedLanguage, string> = {
      [SupportedLanguage.UZ]: 'Buyurtma holati',
      [SupportedLanguage.RU]: 'Статус заказа',
      [SupportedLanguage.EN]: 'Order Update',
    };

    const messages: Record<OrderStatus, Record<SupportedLanguage, string>> = {
      [OrderStatus.NEW]: {
        uz: 'Buyurtmangiz muvaffaqiyatli rasmiylashtirildi.',
        ru: 'Ваш заказ успешно оформлен.',
        en: 'Your order has been placed.',
      },
      [OrderStatus.ACCEPTED]: {
        uz: 'Do\'kon buyurtmangizni qabul qildi.',
        ru: 'Магазин принял ваш заказ.',
        en: 'The shop has accepted your order.',
      },
      [OrderStatus.ON_THE_WAY]: {
        uz: 'Yetkazib beruvchi yo\'lga chiqdi!',
        ru: 'Заказ уже в пути к вам!',
        en: 'Your order is on the way!',
      },
      [OrderStatus.DELIVERED]: {
        uz: 'Buyurtma yetkazildi. Xaridingiz uchun rahmat!',
        ru: 'Заказ доставлен. Спасибо за покупку!',
        en: 'Order delivered. Thank you for your purchase!',
      },
      [OrderStatus.CANCELLED]: {
        uz: 'Buyurtma bekor qilindi.',
        ru: 'Заказ был отменен.',
        en: 'Order was cancelled.',
      },
    };

    return {
      title: titles[lang] || titles.uz,
      body: messages[status]?.[lang] || messages[status]?.uz || 'Buyurtmangiz holati o\'zgardi',
    };
  }

  /**
   * Fans a push out to every device registered for the user (multi-device
   * support via the DeviceToken table), pruning tokens FCM reports as
   * unregistered. No-ops with a log line if Firebase isn't configured yet.
   * Never throws: FCM / DB failures are logged and swallowed.
   */
  private async sendToUser(userId: string, message: PushMessage): Promise<void> {
    this.logger.log(`[Push] -> user ${userId} | "${message.title}" - "${message.body}"`);

    const messaging = this.firebaseService.messaging;
    if (!messaging) {
      return;
    }

    try {
      const devices = await this.prisma.deviceToken.findMany({ where: { user_id: userId } });
      if (devices.length === 0) {
        return;
      }

      const response = await messaging.sendEachForMulticast({
        tokens: devices.map((d) => d.token),
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: {
          priority: message.priority === 'high' ? 'high' : 'normal',
          notification: { channelId: message.channelId, sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });

      const staleTokenIds: string[] = [];
      response.responses.forEach((r, i) => {
        if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' || r.error?.code === 'messaging/invalid-registration-token')) {
          staleTokenIds.push(devices[i].id);
        } else if (!r.success) {
          this.logger.warn(`FCM send failed for device ${devices[i].id}: ${r.error?.message}`);
        }
      });

      if (staleTokenIds.length > 0) {
        await this.prisma.deviceToken.deleteMany({ where: { id: { in: staleTokenIds } } });
      }
    } catch (err: any) {
      this.logger.error(`Push fan-out failed for user ${userId}: ${err?.message ?? err}`);
    }
  }
}
