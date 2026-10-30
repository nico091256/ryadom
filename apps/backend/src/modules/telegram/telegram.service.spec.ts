import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus, UserRole } from '@localshop/shared';

describe('TelegramService', () => {
  let service: TelegramService;
  let prisma: any;
  let ordersService: any;

  beforeEach(async () => {
    prisma = {
      shop: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
    };

    ordersService = {
      updateStatus: jest.fn(),
      cancelOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'TELEGRAM_BOT_TOKEN') return 'fake-test-token';
              if (key === 'TELEGRAM_BOT_USERNAME') return 'DiscoverBPM_bot';
              return null;
            }),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
    (service as any).token = 'fake-test-token';
    // Mock callApi directly
    (service as any).callApi = jest.fn().mockResolvedValue({ ok: true, result: {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOrderNotification', () => {
    it('returns false when shop has no telegram_chat_id', async () => {
      const result = await service.sendOrderNotification(
        { id: 'ord-1', total_amount: 500000 },
        { id: 'shop-1', name: 'Test Shop' },
      );

      expect(result).toBe(false);
      expect((service as any).callApi).not.toHaveBeenCalled();
    });

    it('sends formatted order notification with inline buttons when telegram_chat_id is present', async () => {
      const order = {
        id: 'ord-12345678-abcd',
        total_amount: 3500000, // 35 000 so'm
        payment_method: 'cash',
        delivery_address_text: 'Chilonzor 9-mavze, 12-uy',
        delivery_apartment: '45',
        items: [
          { product_name: 'Non', quantity: 2, total_price: 600000 },
          { product_name: 'Sut', quantity: 1, total_price: 1200000 },
        ],
        customer: { name: 'Ali', phone: '+998901234567' },
      };

      const shop = {
        id: 'shop-1',
        name: 'Olma Do‘koni',
        telegram_chat_id: '123456789',
      };

      const result = await service.sendOrderNotification(order, shop);

      expect(result).toBe(true);
      expect((service as any).callApi).toHaveBeenCalledWith(
        'sendMessage',
        expect.objectContaining({
          chat_id: '123456789',
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '✅ Qabul qilish' }),
                expect.objectContaining({ text: '❌ Bekor qilish' }),
              ]),
            ]),
          }),
        }),
      );
    });
  });

  describe('handleUpdate - /start link_<shopId>', () => {
    it('links shop to chat_id successfully', async () => {
      prisma.shop.findUnique.mockResolvedValue({
        id: 'shop-abc',
        name: 'Oqtepa Do‘kon',
      });
      prisma.shop.update.mockResolvedValue({});

      await service.handleUpdate({
        message: {
          chat: { id: 987654 },
          text: '/start link_shop-abc',
        },
      });

      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { id: 'shop-abc' },
        data: { telegram_chat_id: '987654' },
      });
      expect((service as any).callApi).toHaveBeenCalledWith(
        'sendMessage',
        expect.objectContaining({
          chat_id: '987654',
          text: expect.stringContaining('Oqtepa Do‘kon'),
        }),
      );
    });
  });

  describe('handleUpdate - callback_query accept/reject', () => {
    it('accepts order via Telegram button callback', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.NEW,
        shop: { id: 'shop-1', owner_id: 'seller-1', telegram_chat_id: '111222' },
      });

      await service.handleUpdate({
        callback_query: {
          id: 'cb-1',
          data: 'tg_order:accept:order-1',
          message: {
            message_id: 10,
            chat: { id: 111222 },
            text: 'Yangi buyurtma',
          },
        },
      });

      expect(ordersService.updateStatus).toHaveBeenCalledWith('order-1', 'seller-1', {
        status: OrderStatus.ACCEPTED,
      });
      expect((service as any).callApi).toHaveBeenCalledWith(
        'answerCallbackQuery',
        expect.objectContaining({
          callback_query_id: 'cb-1',
          text: expect.stringContaining('qabul qilindi'),
        }),
      );
    });
  });
});
