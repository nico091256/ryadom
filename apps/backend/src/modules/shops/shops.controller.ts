import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ShopsService } from './shops.service';
import { Public } from '../../common/decorators/public.decorator';
import { NearbyQueryDto, RegisterShopDto, ShopProductsQueryDto } from './shops.dto';

/** Self-registration creates accounts: 3 attempts per IP per hour is plenty for a human. */
const REGISTER_THROTTLE = { default: { limit: 3, ttl: 60 * 60 * 1000 } };

@ApiTags('Shops')
@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Public()
  @Post('register')
  @Throttle(REGISTER_THROTTLE)
  @ApiOperation({ summary: 'Self-service shop registration; creates the shop as pending admin approval (3 req/h per IP)' })
  async register(@Body() dto: RegisterShopDto) {
    return this.shopsService.registerShop(dto);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby active shops within radius (default 3km, max 10km), sorted by distance' })
  async getNearbyShops(@Query() query: NearbyQueryDto) {
    return this.shopsService.findNearby(query.lat, query.lng, query.radius, query.category || undefined);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get shop details by ID (pass lat/lng to get distanceMeters from the customer)' })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  async getShop(@Param('id') id: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    const latNum = lat ? parseFloat(lat) : NaN;
    const lngNum = lng ? parseFloat(lng) : NaN;
    const hasPoint = Number.isFinite(latNum) && Number.isFinite(lngNum);
    return this.shopsService.findOne(id, hasPoint ? { lat: latNum, lng: lngNum } : undefined);
  }

  @Public()
  @Get(':id/products')
  @ApiOperation({
    summary: 'Get products of a shop with category and search filters',
    description:
      'Without `page`/`limit` the response is a bare array (capped at 500 newest products) for backward compatibility. ' +
      'With either `page` or `limit` it is the paginated envelope `{ data, total, page, limit }` (limit default 50, max 100).',
  })
  async getShopProducts(@Param('id') shopId: string, @Query() query: ShopProductsQueryDto) {
    return this.shopsService.findShopProducts(shopId, query.category, query.q, {
      page: query.page,
      limit: query.limit,
    });
  }
}
