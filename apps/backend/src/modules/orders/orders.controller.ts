import {
  Body,
  Controller,
  ConflictException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ERROR_CODES, OrderStatus, PaymentMethod, UserRole } from '@localshop/shared';
import { CreateOrderDto, RejectOrderDto, CancelOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Create new order from customer active shopping cart' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional client-generated key; retried requests with the same key return the original result instead of creating a duplicate order.',
  })
  async createOrder(
    @CurrentUser('id') customerId: string,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      return this.ordersService.createOrder(customerId, dto);
    }

    const scope = `orders:create:${customerId}`;
    const { claimed, cached } = await this.idempotencyService.claim(scope, idempotencyKey);
    if (!claimed) {
      if (cached) return cached;
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_REQUEST,
        message: 'An identical request is already being processed.',
      });
    }

    try {
      const result = await this.ordersService.createOrder(customerId, dto);
      await this.idempotencyService.store(scope, idempotencyKey, result);
      return result;
    } catch (err) {
      await this.idempotencyService.release(scope, idempotencyKey);
      throw err;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List orders (Customer: own; Seller: shop; Admin: all with filters)' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'shopId', required: false, type: String })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: PaymentMethod })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getOrders(
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Query('status') status?: OrderStatus,
    @Query('shopId') shopId?: string,
    @Query('paymentMethod') paymentMethod?: PaymentMethod,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getOrders(actorId, actorRole, {
      status,
      shopId,
      paymentMethod,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single order details with items and status audit history' })
  async getOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
  ) {
    return this.ordersService.getOrderById(orderId, actorId, actorRole);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Seller accepts a new order' })
  async acceptOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') sellerId: string,
  ) {
    return this.ordersService.acceptOrder(orderId, sellerId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Seller rejects a new order (requires reason)' })
  async rejectOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') sellerId: string,
    @Body() dto: RejectOrderDto,
  ) {
    return this.ordersService.rejectOrder(orderId, sellerId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order (Customer: while new; Seller: with reason)' })
  async cancelOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(orderId, actorId, actorRole, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SELLER)
  @ApiOperation({ summary: 'Seller advances order to on_the_way or delivered' })
  async updateStatus(
    @Param('id') orderId: string,
    @CurrentUser('id') sellerId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(orderId, sellerId, dto);
  }
}
