import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, SupportedLanguage } from '@localshop/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async sendOrderStatusPush(userId: string, status: OrderStatus, orderId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { push_token: true, language: true },
      });

      if (!user || !user.push_token) {
        return;
      }

      const lang = (user.language as SupportedLanguage) || SupportedLanguage.UZ;
      const { title, body } = this.getStatusPushMessage(status, lang);

      await this.sendExpoPush({
        to: user.push_token,
        title,
        body,
        data: { orderId, status },
        sound: 'default',
        channelId: 'orders',
      });
    } catch (err: any) {
      this.logger.error(`Error sending push notification to user ${userId}: ${err.message}`);
    }
  }

  async sendNewOrderSellerPush(sellerUserId: string, orderId: string, totalAmountFormatted: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: sellerUserId },
        select: { push_token: true, language: true },
      });

      if (!user || !user.push_token) {
        return;
      }

      const lang = (user.language as SupportedLanguage) || SupportedLanguage.UZ;
      const title = lang === 'ru' ? 'Новый заказ!' : lang === 'en' ? 'New Order!' : 'Yangi buyurtma!';
      const body = lang === 'ru'
        ? `Поступил новый заказ на ${totalAmountFormatted}. Примите в течение 5 минут!`
        : lang === 'en'
        ? `New order for ${totalAmountFormatted}. Please accept within 5 minutes!`
        : `Yangi buyurtma keldi (${totalAmountFormatted}). 5 daqiqa ichida qabul qiling!`;

      await this.sendExpoPush({
        to: user.push_token,
        title,
        body,
        data: { orderId, type: 'NEW_ORDER' },
        sound: 'default',
        channelId: 'orders_high_importance',
        priority: 'high',
      });
    } catch (err: any) {
      this.logger.error(`Error sending seller push notification: ${err.message}`);
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
      [OrderStatus.PREPARING]: {
        uz: 'Buyurtmangiz yig\'ilmoqda va tayyorlanmoqda.',
        ru: 'Ваш заказ собирается и готовится к отправке.',
        en: 'Your order is being prepared.',
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

  private async sendExpoPush(message: {
    to: string;
    title: string;
    body: string;
    data?: any;
    sound?: string;
    channelId?: string;
    priority?: string;
  }) {
    this.logger.log(`[Push Notification] To: ${message.to} | "${message.title}" - "${message.body}"`);

    // In local dev without real device push token, log and return
    if (!message.to.startsWith('ExponentPushToken[') && !message.to.startsWith('ExpoPushToken[')) {
      return;
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.configService.get('EXPO_ACCESS_TOKEN')
            ? { Authorization: `Bearer ${this.configService.get('EXPO_ACCESS_TOKEN')}` }
            : {}),
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        this.logger.warn(`Expo push failed with status: ${response.status}`);
      }
    } catch (err: any) {
      this.logger.warn(`Expo push request error: ${err.message}`);
    }
  }
}
