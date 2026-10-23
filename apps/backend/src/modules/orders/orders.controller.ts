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
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ERROR_CODES, UserRole } from '@localshop/shared';
import { CreateOrderDto, RejectOrderDto, CancelOrderDto, ListOrdersQueryDto, UpdateOrderStatusDto, ReviewOrderDto } from './orders.dto';
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
    const bodyHash = IdempotencyService.hashBody(dto);
    const { claimed, cached, bodyMismatch } = await this.idempotencyService.claim(scope, idempotencyKey, bodyHash);
    if (!claimed) {
      if (bodyMismatch) {
        throw new UnprocessableEntityException({
          code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
          message: 'This Idempotency-Key was already used with a different request body. Use a new key.',
        });
      }
      if (cached) return cached;
      throw new ConflictException({
        code: ERROR_CODES.DUPLICATE_REQUEST,
        message: 'An identical request is already being processed.',
      });
    }

    try {
      const result = await this.ordersService.createOrder(customerId, dto);
      await this.idempotencyService.store(scope, idempotencyKey, bodyHash, result);
      return result;
    } catch (err) {
      await this.idempotencyService.release(scope, idempotencyKey);
      throw err;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List orders (Customer: own; Seller: shop; Admin: all with filters)' })
  async getOrders(
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.getOrders(actorId, actorRole, {
      status: query.status,
      shopId: query.shopId,
      paymentMethod: query.paymentMethod,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
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
  // Admins cancel via the audited POST /admin/orders/:id/cancel instead.
  @Roles(UserRole.CUSTOMER, UserRole.SELLER)
  @ApiOperation({ summary: 'Cancel order (Customer: while new; Seller: with reason). Admins use /admin/orders/:id/cancel' })
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

  @Post(':id/review')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer submits a review/rating for delivered order (PDF Page 17)' })
  async reviewOrder(
    @Param('id') orderId: string,
    @CurrentUser('id') customerId: string,
    @Body() dto: ReviewOrderDto,
  ) {
    return this.ordersService.reviewOrder(orderId, customerId, dto);
  }
}
