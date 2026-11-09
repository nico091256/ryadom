import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { TELEGRAM_WEBHOOK_SECRET_KEY } from './telegram.constants';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRole } from '@localshop/shared';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Telegram bot webhook update receiver' })
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    const expectedSecret = this.configService.get<string>(TELEGRAM_WEBHOOK_SECRET_KEY);
    if (!expectedSecret || !secretToken) {
      throw new UnauthorizedException({
        code: 'INVALID_WEBHOOK_SECRET',
        message: 'Telegram webhook secret token is required',
      });
    }
    const a = Buffer.from(secretToken, 'utf8');
    const b = Buffer.from(expectedSecret, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({
        code: 'INVALID_WEBHOOK_SECRET',
        message: 'Invalid Telegram webhook secret token',
      });
    }
    await this.telegramService.handleUpdate(update);
    return { ok: true };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  @Get('seller/bot-status')
  @ApiOperation({ summary: 'Get Telegram bot connection status for current seller shop' })
  async getBotStatus(@CurrentUser('id') sellerId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { owner_id: sellerId },
      select: { id: true, name: true, telegram_chat_id: true },
    });

    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }

    const botUsername = this.telegramService.getBotUsername();
    const linkUrl = this.telegramService.getShopLinkUrl(shop.id);

    return {
      is_linked: !!shop.telegram_chat_id,
      telegram_chat_id: shop.telegram_chat_id,
      bot_username: botUsername,
      link_url: linkUrl,
      shop_id: shop.id,
    };
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER)
  @Post('seller/unlink')
  @ApiOperation({ summary: 'Unlink Telegram bot from current seller shop' })
  async unlinkBot(@CurrentUser('id') sellerId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { owner_id: sellerId },
    });

    if (!shop) {
      throw new NotFoundException({ code: 'SHOP_NOT_FOUND', message: 'Shop not found' });
    }

    await this.prisma.shop.update({
      where: { id: shop.id },
      data: { telegram_chat_id: null },
    });

    return { success: true, message: 'Shop unlinked from Telegram bot' };
  }
}
