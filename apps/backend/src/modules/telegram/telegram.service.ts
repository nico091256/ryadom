import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus, UserRole, formatPrice } from '@localshop/shared';
import {
  TELEGRAM_API_BASE,
  TELEGRAM_BOT_TOKEN_KEY,
  TELEGRAM_BOT_USERNAME_KEY,
} from './telegram.constants';

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private token: string | null = null;
  private botUsername: string | null = null;
  private isPolling = false;
  private pollAbortController: AbortController | null = null;
  private lastUpdateId = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  async onModuleInit() {
    this.token = this.configService.get<string>(TELEGRAM_BOT_TOKEN_KEY) || null;
    this.botUsername = this.configService.get<string>(TELEGRAM_BOT_USERNAME_KEY) || null;

    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not set. Telegram seller notifications are disabled.');
      return;
    }

    try {
      const me = await this.callApi<{ id: number; username: string }>('getMe');
      if (me && me.username) {
        this.botUsername = me.username;
        this.logger.log(`Telegram Bot @${me.username} successfully initialized.`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to initialize Telegram Bot: ${err.message}`);
      return;
    }

    // Start long-polling in development or when no webhook is set
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  getBotUsername(): string | null {
    return this.botUsername;
  }

  getShopLinkUrl(shopId: string): string | null {
    if (!this.botUsername) return null;
    return `https://t.me/${this.botUsername}?start=link_${shopId}`;
  }

  /**
   * Sends an order notification to the shop's Telegram chat if connected.
   */
  async sendOrderNotification(order: any, shop: any): Promise<boolean> {
    if (!this.token) return false;

    // Check if shop has telegram_chat_id
    const targetChatId = shop?.telegram_chat_id;
    if (!targetChatId) {
      this.logger.debug(`Shop ${shop?.id} has no telegram_chat_id configured.`);
      return false;
    }

    try {
      const orderShortId = order.id.slice(0, 8).toUpperCase();
      const formattedTotal = formatPrice(order.total_amount);
      const paymentText = order.payment_method === 'cash' ? 'Naqd pul 💵' : 'Online to‘lov 💳';
      
      const itemsList = Array.isArray(order.items)
        ? order.items
            .map((item: any) => `• <b>${escapeHtml(item.product_name)}</b> x ${item.quantity} = ${formatPrice(item.total_price)} so‘m`)
            .join('\n')
        : '';

      const addressDetails = [
        order.delivery_address_text ? escapeHtml(order.delivery_address_text) : '',
        order.delivery_entrance ? `Podyezd: ${order.delivery_entrance}` : '',
        order.delivery_floor ? `Qavat: ${order.delivery_floor}` : '',
        order.delivery_apartment ? `Xonadon: ${order.delivery_apartment}` : '',
      ].filter(Boolean).join(', ');

      const customerName = escapeHtml(order.customer?.name || 'Xaridor');
      const customerPhone = order.customer?.phone || 'Mavjud emas';

      const messageText = [
        `🔔 <b>YANGI BUYURTMA! #${orderShortId}</b>`,
        `🏪 Do‘kon: <b>${escapeHtml(shop.name)}</b>`,
        '',
        `🛒 <b>Mahsulotlar:</b>`,
        itemsList,
        '',
        `💰 <b>Jami summa:</b> <b>${formattedTotal} so‘m</b>`,
        `💳 <b>To‘lov:</b> ${paymentText}`,
        `📍 <b>Manzil:</b> ${addressDetails}`,
        `👤 <b>Mijoz:</b> ${customerName} (${customerPhone})`,
        '',
        `⏱ <i>Iltimos, buyurtmani 10 daqiqa ichida qabul qiling!</i>`,
      ].join('\n');

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '✅ Qabul qilish',
              callback_data: `tg_order:accept:${order.id}`,
            },
            {
              text: '❌ Bekor qilish',
              callback_data: `tg_order:reject:${order.id}`,
            },
          ],
        ],
      };

      await this.callApi('sendMessage', {
        chat_id: targetChatId,
        text: messageText,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      });

      this.logger.log(`Telegram order notification sent for #${orderShortId} to chat ${targetChatId}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram order notification: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Process incoming update from Webhook or Long Polling.
   */
  async handleUpdate(update: any): Promise<void> {
    if (!update) return;

    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(message: any) {
    const text = message.text?.trim() || '';
    const chatId = String(message.chat.id);

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const payload = parts[1] || '';

      if (payload.startsWith('link_')) {
        const shopId = payload.replace('link_', '').trim();
        await this.linkShopToChat(shopId, chatId);
        return;
      }

      // Check if this chat is already linked to any shop
      const linkedShop = await this.prisma.shop.findFirst({
        where: { telegram_chat_id: chatId },
        select: { id: true, name: true },
      });

      if (linkedShop) {
        await this.sendMessage(
          chatId,
          `Assalomu alaykum!\n\nUshbu chat hozirda <b>"${escapeHtml(linkedShop.name)}"</b> do‘koniga ulangan. Yangi buyurtmalar kelganda shu yerga bildirishnoma yuboriladi.`,
        );
      } else {
        await this.sendMessage(
          chatId,
          `Assalomu alaykum!\n\nBu Ryadom platformasining do‘konchilar uchun xabarnoma boti.\n\nDo‘koningizni ulash uchun, do‘koningiz boshqaruv paneliga kiring va <b>"Telegram botni ulash"</b> tugmasini bosing.`,
        );
      }
      return;
    }

    if (text === '/unlink') {
      const updated = await this.prisma.shop.updateMany({
        where: { telegram_chat_id: chatId },
        data: { telegram_chat_id: null },
      });

      if (updated.count > 0) {
        await this.sendMessage(chatId, `✅ Do‘koningiz Telegram botdan muvaffaqiyatli uzildi.`);
      } else {
        await this.sendMessage(chatId, `Ushbu chat hech qaysi do‘konga ulanmagan.`);
      }
      return;
    }
  }

  private async handleCallbackQuery(callbackQuery: any) {
    const callbackData = callbackQuery.data || '';
    const queryId = callbackQuery.id;
    const message = callbackQuery.message;
    const chatId = String(message?.chat?.id);

    if (!callbackData.startsWith('tg_order:')) {
      return;
    }

    const [, action, orderId] = callbackData.split(':');
    if (!action || !orderId) return;

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { shop: true },
      });

      if (!order) {
        await this.answerCallback(queryId, 'Buyurtma topilmadi!');
        return;
      }

      // Verify that this chat is authorised for the shop
      if (order.shop.telegram_chat_id !== chatId) {
        await this.answerCallback(queryId, 'Sizda bu buyurtmani boshqarish huquqi yo‘q!');
        return;
      }

      if (action === 'accept') {
        if (order.status !== OrderStatus.NEW) {
          await this.answerCallback(queryId, `Buyurtma allaqachon ${order.status} holatida!`);
          return;
        }

        await this.ordersService.updateStatus(order.id, order.shop.owner_id, {
          status: OrderStatus.ACCEPTED,
        });

        await this.answerCallback(queryId, '✅ Buyurtma qabul qilindi!');

        // Update telegram message text removing the buttons
        const originalText = message.text || '';
        await this.editMessageText(
          chatId,
          message.message_id,
          `${originalText}\n\n<b>✅ Buyurtma qabul qilindi! (${new Date().toLocaleTimeString('uz-UZ')})</b>`,
        );
      } else if (action === 'reject') {
        if (order.status !== OrderStatus.NEW) {
          await this.answerCallback(queryId, `Buyurtma allaqachon ${order.status} holatida!`);
          return;
        }

        await this.ordersService.cancelOrder(
          order.id,
          order.shop.owner_id,
          UserRole.SELLER,
          { reason: 'Do‘konchi Telegram orqali rad etdi' },
        );

        await this.answerCallback(queryId, '❌ Buyurtma bekor qilindi!');

        const originalText = message.text || '';
        await this.editMessageText(
          chatId,
          message.message_id,
          `${originalText}\n\n<b>❌ Buyurtma bekor qilindi. (${new Date().toLocaleTimeString('uz-UZ')})</b>`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error processing callback query ${callbackData}: ${err.message}`, err.stack);
      await this.answerCallback(queryId, `Xatolik: ${err.message}`);
    }
  }

  private async linkShopToChat(shopId: string, chatId: string) {
    try {
      const shop = await this.prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        await this.sendMessage(chatId, `❌ Do‘kon topilmadi.`);
        return;
      }

      await this.prisma.shop.update({
        where: { id: shopId },
        data: { telegram_chat_id: chatId },
      });

      await this.sendMessage(
        chatId,
        `🎉 <b>Tabriklaymiz!</b>\n\nSiz <b>"${escapeHtml(shop.name)}"</b> do‘konini ushbu Telegram akkauntga muvaffaqiyatli bog‘ladingiz.\n\nEndi yangi buyurtma tushishi bilan sizga darhol xabar va boshqaruv tugmalari yuboriladi.`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to link shop ${shopId} to chat ${chatId}: ${err.message}`);
      await this.sendMessage(chatId, `❌ Do‘konni bog‘lashda xatolik yuz berdi.`);
    }
  }

  private async sendMessage(chatId: string, text: string) {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    });
  }

  private async editMessageText(chatId: string, messageId: number, text: string) {
    return this.callApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] },
    });
  }

  private async answerCallback(callbackQueryId: string, text: string) {
    return this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    });
  }

  private async callApi<T = any>(method: string, data?: any): Promise<T> {
    if (!this.token) {
      throw new Error('Telegram bot token not provided.');
    }
    const url = `${TELEGRAM_API_BASE}/bot${this.token}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.description || `Telegram API error on ${method}`);
    }
    return result.result;
  }

  private startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollAbortController = new AbortController();

    this.logger.log('Starting Telegram Bot long-polling listener...');

    const poll = async () => {
      while (this.isPolling) {
        try {
          const updates = await this.callApi<any[]>('getUpdates', {
            offset: this.lastUpdateId + 1,
            timeout: 25,
            allowed_updates: ['message', 'callback_query'],
          });

          if (Array.isArray(updates) && updates.length > 0) {
            for (const update of updates) {
              this.lastUpdateId = update.update_id;
              await this.handleUpdate(update).catch((err) =>
                this.logger.error(`Error in handleUpdate: ${err.message}`),
              );
            }
          }
        } catch (err: any) {
          if (!this.isPolling) break;
          this.logger.warn(`Telegram polling warning: ${err.message}`);
          // Sleep 3 seconds on error before retrying
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    };

    poll();
  }

  private stopPolling() {
    this.isPolling = false;
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }
  }
}
