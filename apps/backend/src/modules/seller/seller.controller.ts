import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SellerService } from './seller.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@localshop/shared';
import { CreateProductDto, SellerProductsQueryDto, UpdateProductDto, UpdateShopProfileDto } from './seller.dto';

@ApiTags('Seller')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.SELLER)
@Controller('seller')
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Get('shop')
  @ApiOperation({ summary: 'Get current seller shop details' })
  async getShop(@CurrentUser('id') sellerId: string) {
    return this.sellerService.getSellerShop(sellerId);
  }

  @Put('shop')
  @ApiOperation({ summary: 'Update shop profile, hours, and Open/Closed switch' })
  async updateShop(
    @CurrentUser('id') sellerId: string,
    @Body() dto: UpdateShopProfileDto,
  ) {
    return this.sellerService.updateShopProfile(sellerId, dto);
  }

  @Get('products')
  @ApiOperation({
    summary: 'Get products belonging to seller shop',
    description:
      'Without `page`/`limit` the response is a bare array (capped at 500 newest products) for backward compatibility. ' +
      'With either `page` or `limit` it is the paginated envelope `{ data, total, page, limit }` (limit default 50, max 100).',
  })
  async getProducts(@CurrentUser('id') sellerId: string, @Query() query: SellerProductsQueryDto) {
    return this.sellerService.getProducts(sellerId, { page: query.page, limit: query.limit });
  }

  @Post('products')
  @ApiOperation({ summary: 'Create new product in seller shop' })
  async createProduct(
    @CurrentUser('id') sellerId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.sellerService.createProduct(sellerId, dto);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Update existing product' })
  async updateProduct(
    @CurrentUser('id') sellerId: string,
    @Param('id') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.sellerService.updateProduct(sellerId, productId, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Soft delete product from shop' })
  async deleteProduct(
    @CurrentUser('id') sellerId: string,
    @Param('id') productId: string,
  ) {
    return this.sellerService.deleteProduct(sellerId, productId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get orders count and revenue metrics for today, this week, this month' })
  @ApiQuery({ name: 'period', required: false })
  async getStats(@CurrentUser('id') sellerId: string) {
    return this.sellerService.getStats(sellerId);
  }
}
