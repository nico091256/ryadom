import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ShopsService } from './shops.service';
import { Public } from '../../common/decorators/public.decorator';
import { RegisterShopDto } from './shops.dto';

@ApiTags('Shops')
@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Self-service shop registration; creates the shop as pending admin approval' })
  async register(@Body() dto: RegisterShopDto) {
    return this.shopsService.registerShop(dto);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby active shops within 3km, sorted by distance' })
  @ApiQuery({ name: 'lat', required: true, type: Number })
  @ApiQuery({ name: 'lng', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Only shops with available products in this category' })
  async getNearbyShops(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('category') categoryId?: string,
  ) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = radius ? parseInt(radius, 10) : 3000;
    return this.shopsService.findNearby(latNum, lngNum, radiusNum, categoryId || undefined);
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
  @ApiOperation({ summary: 'Get products of a shop with category and search filters' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'q', required: false, type: String })
  async getShopProducts(
    @Param('id') shopId: string,
    @Query('category') categoryId?: string,
    @Query('q') query?: string,
  ) {
    return this.shopsService.findShopProducts(shopId, categoryId, query);
  }
}
