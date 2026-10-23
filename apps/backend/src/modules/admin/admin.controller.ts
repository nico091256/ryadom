import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminActor, AdminService } from './admin.service';
import { AuditService } from './audit.service';
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
  AdminUpdateCategoryDto,
  AdminUpdateProductDto,
  AdminUpdatePromoCodeDto,
  AdminUpdateShopDto,
} from './admin.dto';

/** Builds the audit actor (admin id + client ip) for a mutating request. */
function actorOf(adminId: string, req: Request): AdminActor {
  return { id: adminId, ip: req.ip ?? null };
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  // ── Dashboard ──

  @Get('stats')
  @ApiOperation({ summary: 'Platform dashboard: totals, status breakdown, 30-day trend, top shops, recent orders' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ── Audit log ──

  @Get('audit-log')
  @ApiOperation({ summary: 'Audit trail of mutating admin actions (paginated, newest first)' })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'targetType', required: false, enum: ['shop', 'order', 'user', 'product', 'category', 'promo'] })
  @ApiQuery({ name: 'action', required: false, description: "e.g. 'shop.block', 'order.cancel'" })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAuditLog(
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.list({ actorId, targetType, action, page, limit });
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
    @Req() req: Request,
  ) {
    return this.adminService.cancelOrder(orderId, adminId, dto.reason, req.ip ?? null);
  }

  // ── Shops ──

  @Post('shops')
  @ApiOperation({ summary: 'Create a shop together with its shopkeeper account' })
  async createShop(@Body() dto: AdminCreateShopDto, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.createShop(dto, actorOf(adminId, req));
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
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    return this.adminService.updateShop(shopId, dto, actorOf(adminId, req));
  }

  @Post('shops/:id/approve')
  @ApiOperation({ summary: 'Approve a self-registered (pending) shop, making it visible to customers' })
  async approveShop(@Param('id') shopId: string, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.approveShop(shopId, actorOf(adminId, req));
  }

  @Post('shops/:id/block')
  @ApiOperation({ summary: 'Block a shop (hidden from customers, cannot accept orders)' })
  async blockShop(@Param('id') shopId: string, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.blockShop(shopId, actorOf(adminId, req));
  }

  @Post('shops/:id/unblock')
  @ApiOperation({ summary: 'Unblock a previously blocked shop' })
  async unblockShop(@Param('id') shopId: string, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.unblockShop(shopId, actorOf(adminId, req));
  }

  @Post('shops/:id/reset-password')
  @ApiOperation({ summary: 'Reset the shopkeeper password to a random temporary one' })
  async resetShopPassword(@Param('id') shopId: string, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.resetShopPassword(shopId, actorOf(adminId, req));
  }

  // ── Products (moderation) ──

  @Patch('products/:id')
  @ApiOperation({ summary: 'Moderate a product (toggle availability)' })
  async updateProduct(
    @Param('id') productId: string,
    @Body() dto: AdminUpdateProductDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    return this.adminService.updateProduct(productId, dto, actorOf(adminId, req));
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Soft-delete a product' })
  async deleteProduct(@Param('id') productId: string, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.deleteProduct(productId, actorOf(adminId, req));
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
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    return this.adminService.toggleBlockUser(userId, dto.is_blocked, actorOf(adminId, req));
  }

  // ── Categories ──

  @Get('categories')
  @ApiOperation({ summary: 'List categories with product counts' })
  async getCategories() {
    return this.adminService.getCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a global category' })
  async createCategory(@Body() dto: AdminCategoryDto, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.createCategory(dto, actorOf(adminId, req));
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update a global category' })
  async updateCategory(
    @Param('id') categoryId: string,
    @Body() dto: AdminUpdateCategoryDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    return this.adminService.updateCategory(categoryId, dto, actorOf(adminId, req));
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category (409 if products use it)' })
  async deleteCategory(@Param('id') categoryId: string, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.deleteCategory(categoryId, actorOf(adminId, req));
  }

  // ── Promo codes ──

  @Get('promo-codes')
  @ApiOperation({ summary: 'List promo codes (newest first)' })
  async getPromoCodes() {
    return this.adminService.getPromoCodes();
  }

  @Post('promo-codes')
  @ApiOperation({ summary: 'Create a promo code' })
  async createPromoCode(@Body() dto: AdminCreatePromoCodeDto, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.createPromoCode(dto, actorOf(adminId, req));
  }

  @Patch('promo-codes/:id')
  @ApiOperation({ summary: 'Update a promo code (code itself is not editable)' })
  async updatePromoCode(
    @Param('id') id: string,
    @Body() dto: AdminUpdatePromoCodeDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    return this.adminService.updatePromoCode(id, dto, actorOf(adminId, req));
  }

  @Delete('promo-codes/:id')
  @ApiOperation({ summary: 'Delete a promo code' })
  async deletePromoCode(@Param('id') id: string, @CurrentUser('id') adminId: string, @Req() req: Request) {
    return this.adminService.deletePromoCode(id, actorOf(adminId, req));
  }
}
