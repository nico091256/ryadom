import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@localshop/shared';
import {
  AdminBlockUserDto,
  AdminCancelOrderDto,
  AdminCategoryDto,
  AdminCreatePromoCodeDto,
  AdminCreateShopDto,
  AdminUpdateProductDto,
  AdminUpdatePromoCodeDto,
  AdminUpdateShopDto,
} from './admin.dto';
import { CategoriesService } from '../categories/categories.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly categoriesService: CategoriesService,
  ) {}

  // ── Dashboard ──

  @Get('stats')
  @ApiOperation({ summary: 'Platform dashboard: totals, status breakdown, 30-day trend, top shops, recent orders' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ── Orders ──

  @Get('orders')
  @ApiOperation({ summary: 'List all orders with filters (paginated)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'paymentMethod', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Order id prefix, customer phone or name' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (inclusive)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getOrders(
    @Query('status') status?: string,
    @Query('shopId') shopId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getOrders({ status, shopId, paymentMethod, q, from, to, page, limit });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Order details with items and status history' })
  async getOrder(@Param('id') orderId: string) {
    return this.adminService.getOrder(orderId);
  }

  @Post('orders/:id/cancel')
  @ApiOperation({ summary: 'Force-cancel an order (any non-final status), restoring stock' })
  async cancelOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: AdminCancelOrderDto,
  ) {
    return this.adminService.cancelOrder(orderId, adminId, dto.reason);
  }

  // ── Shops ──

  @Post('shops')
  @ApiOperation({ summary: 'Create a shop together with its shopkeeper account' })
  async createShop(@Body() dto: AdminCreateShopDto) {
    return this.adminService.createShop(dto);
  }

  @Get('shops')
  @ApiOperation({ summary: 'List shops with owner accounts and stats (paginated)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getShops(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getShops({ q, status, page, limit });
  }

  @Get('shops/:id')
  @ApiOperation({ summary: 'Shop details with products and stats' })
  async getShop(@Param('id') shopId: string) {
    return this.adminService.getShop(shopId);
  }

  @Patch('shops/:id')
  @ApiOperation({ summary: 'Update shop details, hours, location, commission or active status' })
  async updateShop(
    @Param('id') shopId: string,
    @Body() dto: AdminUpdateShopDto,
  ) {
    return this.adminService.updateShop(shopId, dto);
  }

  @Post('shops/:id/reset-password')
  @ApiOperation({ summary: 'Reset the shopkeeper password to a random temporary one' })
  async resetShopPassword(@Param('id') shopId: string) {
    return this.adminService.resetShopPassword(shopId);
  }

  // ── Products (moderation) ──

  @Patch('products/:id')
  @ApiOperation({ summary: 'Moderate a product (toggle availability)' })
  async updateProduct(@Param('id') productId: string, @Body() dto: AdminUpdateProductDto) {
    return this.adminService.updateProduct(productId, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Soft-delete a product' })
  async deleteProduct(@Param('id') productId: string) {
    return this.adminService.deleteProduct(productId);
  }

  // ── Users ──

  @Get('users')
  @ApiOperation({ summary: 'List and search platform users (paginated)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'blocked', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getUsers(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('blocked') blocked?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers({ q, role, blocked, page, limit });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'User details with addresses, recent orders and shop' })
  async getUser(@Param('id') userId: string) {
    return this.adminService.getUser(userId);
  }

  @Patch('users/:id/block')
  @ApiOperation({ summary: 'Block or unblock a user account (admins cannot be blocked)' })
  async toggleBlockUser(
    @Param('id') userId: string,
    @Body() dto: AdminBlockUserDto,
  ) {
    return this.adminService.toggleBlockUser(userId, dto.is_blocked);
  }

  // ── Categories ──

  @Get('categories')
  @ApiOperation({ summary: 'List categories with product counts' })
  async getCategories() {
    return this.adminService.getCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a global category' })
  async createCategory(@Body() dto: AdminCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update a global category' })
  async updateCategory(
    @Param('id') categoryId: string,
    @Body() dto: Partial<AdminCategoryDto>,
  ) {
    return this.categoriesService.update(categoryId, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category (409 if products use it)' })
  async deleteCategory(@Param('id') categoryId: string) {
    return this.adminService.deleteCategory(categoryId);
  }

  // ── Promo codes ──

  @Get('promo-codes')
  @ApiOperation({ summary: 'List promo codes (newest first)' })
  async getPromoCodes() {
    return this.adminService.getPromoCodes();
  }

  @Post('promo-codes')
  @ApiOperation({ summary: 'Create a promo code' })
  async createPromoCode(@Body() dto: AdminCreatePromoCodeDto) {
    return this.adminService.createPromoCode(dto);
  }

  @Patch('promo-codes/:id')
  @ApiOperation({ summary: 'Update a promo code (code itself is not editable)' })
  async updatePromoCode(@Param('id') id: string, @Body() dto: AdminUpdatePromoCodeDto) {
    return this.adminService.updatePromoCode(id, dto);
  }

  @Delete('promo-codes/:id')
  @ApiOperation({ summary: 'Delete a promo code' })
  async deletePromoCode(@Param('id') id: string) {
    return this.adminService.deletePromoCode(id);
  }
}
