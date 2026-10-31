import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PosApiKeyGuard, PosShop } from './pos-api-key.guard';
import { PosOrderStatusDto, PosPendingOrdersQueryDto, PosSyncProductsDto } from './pos.dto';
import { PosService, PosShopRef } from './pos.service';

/** Cash registers poll and sync often; still bounded per client IP. */
const POS_THROTTLE = { default: { limit: 300, ttl: 60 * 1000 } };

/**
 * Integration surface for the shop's cash-register software (1C, Jowi, iiko,
 * Billz, Poster or anything custom). No user session: every call carries the
 * shop's POS API key (`X-API-Key`), issued in the store panel.
 */
@ApiTags('POS')
@ApiHeader({ name: 'X-API-Key', required: true, description: 'Shop POS API key from the store panel' })
@Public()
@UseGuards(PosApiKeyGuard)
@Throttle(POS_THROTTLE)
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('products/sync')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bulk-update price / stock / availability by barcode or sku (max 500 items)' })
  async syncProducts(@PosShop() shop: PosShopRef, @Body() dto: PosSyncProductsDto) {
    return this.posService.syncProducts(shop, dto.items);
  }

  // `incoming` is the alias some integrators expect; both paths serve the same pull.
  @Get(['orders/incoming', 'orders/pending'])
  @ApiOperation({ summary: 'Pull orders in a lifecycle state (default: new), oldest first' })
  async pendingOrders(@PosShop() shop: PosShopRef, @Query() query: PosPendingOrdersQueryDto) {
    return this.posService.pendingOrders(shop, query);
  }

  @Post('orders/:id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Move an order: accepted | on_the_way | delivered | cancelled (reason required)' })
  async updateOrderStatus(@PosShop() shop: PosShopRef, @Param('id') orderId: string, @Body() dto: PosOrderStatusDto) {
    return this.posService.updateOrderStatus(shop, orderId, dto);
  }
}
