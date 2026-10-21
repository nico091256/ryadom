import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MetricsService } from '../../common/observability/metrics.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationService } from '../notifications/push-notification.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto, RejectOrderDto, CancelOrderDto, UpdateOrderStatusDto, ReviewOrderDto } from './orders.dto';
import { ORDER_AUTO_CANCEL_JOB, ORDER_AUTO_CANCEL_QUEUE } from './orders.constants';
import {
  ALLOWED_STATUS_TRANSITIONS,
  CANCELLATION_ALLOWED_ROLES,
  ERROR_CODES,
  ORDER_ACCEPTANCE_TIMEOUT_MS,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  formatPrice,
} from '@localshop/shared';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
    private pushNotificationService: PushNotificationService,
    private paymentsService: PaymentsService,
    @InjectQueue(ORDER_AUTO_CANCEL_QUEUE) private autoCancelQueue: Queue,
    // Optional so unit tests can construct the service without the metrics registry.
    @Optional() private metrics?: MetricsService,
  ) {}

  /**
   * Customer places an order from their active cart.
   * Atomically decrements stock and initializes order.
   */
  async createOrder(customerId: string, dto: CreateOrderDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { user_id: customerId },
      include: {
        shop: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException({
        code: 'CART_EMPTY',
        message: 'Your cart is empty. Please add items before checking out.',
      });
    }

    // Promo code is validated against the promo_codes table inside the transaction below
    const promoCode = dto.promo_code?.trim().toUpperCase() || null;

    const shop = cart.shop;
    if (!shop.is_active || shop.status !== ('active' as any)) {
      throw new ConflictException({
        code: ERROR_CODES.SHOP_INACTIVE,
        message: 'This shop is not active. Orders cannot be accepted.',
      });
    }
    if (!shop.is_open) {
      throw new ConflictException({
        code: ERROR_CODES.SHOP_CLOSED,
        message: 'This shop is currently closed. Orders cannot be accepted.',
      });
    }

    // Perform atomic transaction: check & decrement stock, create order, clear cart
    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Atomically validate and decrement stock in a single conditional update
      let totalAmount = 0;
      for (const item of cart.items) {
        const res = await tx.product.updateMany({
          where: {
            id: item.product_id,
            is_available: true,
            deleted_at: null,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (res.count === 0) {
          throw new ConflictException({
            code: ERROR_CODES.OUT_OF_STOCK,
            message: `Insufficient stock for product '${item.product.name_uz}'.`,
          });
        }

        totalAmount += item.product.price * item.quantity;
      }

      // 2. Snapshot address
      const addressSnapshot = {
        lat: dto.lat,
        lng: dto.lng,
        text: dto.address_text,
      };

      // 3. Apply promo discount to the stored/charged total
      let comment = dto.comment?.trim() || '';
      let discountAmount = 0;
      if (promoCode) {
        const discount = await this.applyPromoCode(tx, promoCode, totalAmount);
        discountAmount = discount;
        totalAmount -= discount;
        const promoLine = `Promokod: ${promoCode} (-${formatPrice(discount)})`;
        comment = comment ? `${comment}
${promoLine}` : promoLine;
      }

      // 4. Commission snapshot
      const commissionRate = shop.commission_rate_percent || 0;
      const commissionAmount = Math.round((totalAmount * commissionRate) / 100);

      // 4. Create Order
      const newOrder = await tx.order.create({
        data: {
          customer_id: customerId,
          shop_id: shop.id,
          address_snapshot: addressSnapshot,
          customer_phone: dto.customer_phone,
          status: OrderStatus.NEW as any,
          payment_method: dto.payment_method as any,
          payment_status: PaymentStatus.PENDING as any,
          total_amount: totalAmount,
          commission_rate_percent: commissionRate,
          commission_amount: commissionAmount,
          promo_code: promoCode,
          discount_amount: discountAmount,
          comment: comment || null,
          needs_attention: false,
          items: {
            create: cart.items.map((i) => ({
              product_id: i.product_id,
              product_name: i.product.name_uz,
              unit_price: i.product.price,
              quantity: i.quantity,
            })),
          },
          status_history: {
            create: {
              status: OrderStatus.NEW as any,
              changed_by: customerId,
              reason: 'Order placed by customer',
            },
          },
        },
        include: {
          items: true,
          shop: {
            select: { id: true, name: true, phone: true, owner_id: true },
          },
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      // 5. Clear cart
      await tx.cartItem.deleteMany({ where: { cart_id: cart.id } });
      await tx.cart.delete({ where: { id: cart.id } });

      return newOrder;
    }, { timeout: 5000, maxWait: 2000 });

    // 6. Broadcast Realtime Socket.IO event to Seller Room
    this.metrics?.ordersCreated.inc();
    this.notificationsGateway.broadcastNewOrder(shop.id, order);

    // 7. Dispatch High-Priority Push Notification to Seller
    const formattedTotal = formatPrice(order.total_amount);
    this.pushNotificationService.sendNewOrderSellerPush(shop.owner_id, order.id, formattedTotal);

    // 8. Schedule the hard auto-cancel job (10-minute acceptance window)
    await this.scheduleAutoCancel(order.id);

    return order;
  }

  /**
   * Enqueues the delayed auto-cancel job. The order itself is already committed, so a
   * missing/unreachable Redis (local dev without Docker) must not fail or hang the
   * request: BullMQ queues commands offline indefinitely, hence the explicit timeout.
   */
  private async scheduleAutoCancel(orderId: string): Promise<void> {
    await this.withQueueTimeout(
      this.autoCancelQueue.add(
        ORDER_AUTO_CANCEL_JOB,
        { orderId },
        { delay: ORDER_ACCEPTANCE_TIMEOUT_MS, jobId: orderId, removeOnComplete: true, removeOnFail: true },
      ),
      `Auto-cancel job for order ${orderId} was NOT scheduled; the order will not expire automatically until Redis is reachable.`,
    );
  }

  /** Drops the pending auto-cancel job once the order has left 'new'. */
  private async dropAutoCancel(orderId: string): Promise<void> {
    await this.withQueueTimeout(
      this.autoCancelQueue.remove(orderId),
      `Auto-cancel job for order ${orderId} could not be removed; the processor re-checks the status before acting, so this is harmless.`,
    );
  }

  /**
   * BullMQ queues commands offline indefinitely, so without Redis every queue
   * call would hang the HTTP request. Race it against a short timeout and log
   * instead — the DB write that matters has already happened by then.
   */
  private async withQueueTimeout(operation: Promise<unknown>, failureMessage: string, ms = 1500): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Redis did not respond within ${ms}ms`)), ms);
    });
    try {
      await Promise.race([operation, timeout]);
    } catch (err: any) {
      this.logger.error(`${failureMessage} (${err?.message ?? err})`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Validates a promo code against the promo_codes table (inside the order transaction),
   * atomically increments its usage_count and returns the discount in tiyin.
   */
  private async applyPromoCode(tx: any, code: string, basketTotal: number): Promise<number> {
    const invalid = (message: string) =>
      new BadRequestException({ code: 'INVALID_PROMO_CODE', message });

    const promo = await tx.promoCode.findUnique({ where: { code } });
    if (!promo) {
      throw invalid(`Promokod '${code}' topilmadi / Promo code '${code}' not found.`);
    }
    if (!promo.is_active) {
      throw invalid(`Promokod '${code}' faol emas / Promo code '${code}' is not active.`);
    }
    if (promo.expires_at && promo.expires_at.getTime() <= Date.now()) {
      throw invalid(`Promokod '${code}' muddati tugagan / Promo code '${code}' has expired.`);
    }
    if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
      throw invalid(`Promokod '${code}' foydalanish limiti tugagan / Promo code '${code}' usage limit reached.`);
    }
    if (promo.min_order_tiyin !== null && basketTotal < promo.min_order_tiyin) {
      throw invalid(
        `Minimal buyurtma summasi ${formatPrice(promo.min_order_tiyin)} / Minimum order for '${code}' is ${formatPrice(promo.min_order_tiyin)}.`,
      );
    }

    let discount = Math.round((basketTotal * promo.discount_percent) / 100);
    if (promo.max_discount_tiyin !== null && discount > promo.max_discount_tiyin) {
      discount = promo.max_discount_tiyin;
    }
    discount = Math.min(discount, basketTotal);

    // Conditional increment guards against concurrent redemptions exceeding usage_limit
    const updated = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        ...(promo.usage_limit !== null ? { usage_count: { lt: promo.usage_limit } } : {}),
      },
      data: { usage_count: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw invalid(`Promokod '${code}' foydalanish limiti tugagan / Promo code '${code}' usage limit reached.`);
    }

    return discount;
  }

  /**
   * Admin force-cancels an order in any non-final status (new..on_the_way).
   * Mirrors the regular cancel flow: restores stock, writes history, emits realtime + push events.
   */
  async adminCancelOrder(orderId: string, adminId: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shop: true },
    });

    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    if (order.status === (OrderStatus.DELIVERED as any) || order.status === (OrderStatus.CANCELLED as any)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_CANCELLABLE',
        message: `Order in status '${order.status}' cannot be cancelled.`,
      });
    }

    const cancelReason = reason?.trim() || 'Cancelled by admin';

    await this.prisma.$transaction(async (tx) => {
      // Guard against a concurrent status change
      const res = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.CANCELLED as any, needs_attention: false },
      });
      if (res.count === 0) {
        throw new ConflictException({
          code: ERROR_CODES.INVALID_STATUS_TRANSITION,
          message: 'Order status changed concurrently. Please refresh and try again.',
        });
      }

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          order_id: orderId,
          status: OrderStatus.CANCELLED as any,
          changed_by: adminId,
          reason: cancelReason,
        },
      });
    });

    const timestamp = new Date().toISOString();
    this.notificationsGateway.broadcastOrderStatus(orderId, order.customer_id, OrderStatus.CANCELLED, timestamp);
    this.notificationsGateway.broadcastOrderCancelled(order.shop_id, orderId, cancelReason);
    this.pushNotificationService.sendOrderStatusPush(order.customer_id, OrderStatus.CANCELLED, orderId);
    this.pushNotificationService.sendOrderStatusPush(order.shop.owner_id, OrderStatus.CANCELLED, orderId);

    return { id: orderId };
  }

  /**
   * Get orders list based on actor role
   */
  async getOrders(
    actorId: string,
    actorRole: UserRole,
    filters: { status?: OrderStatus; shopId?: string; date?: string; paymentMethod?: PaymentMethod; page?: number; limit?: number },
  ) {
    const page = filters.page ? Math.max(1, filters.page) : 1;
    const limit = filters.limit ? Math.min(100, Math.max(1, filters.limit)) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (actorRole === UserRole.CUSTOMER) {
      where.customer_id = actorId;
    } else if (actorRole === UserRole.SELLER) {
      // Find seller's shop
      const shop = await this.prisma.shop.findFirst({ where: { owner_id: actorId } });
      if (!shop) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      where.shop_id = shop.id;
    } else if (actorRole === UserRole.ADMIN) {
      if (filters.shopId) {
        where.shop_id = filters.shopId;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentMethod) {
      where.payment_method = filters.paymentMethod;
    }

    // List payload is intentionally lean: it carries only what the list views read
    // (apps/store OrderCard, mobile_client Order.fromJson). The full shape (items.product,
    // status_history.actor) is served by getOrderById.
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          shop: { select: { id: true, name: true, phone: true, logo_url: true } },
          customer: { select: { id: true, name: true, phone: true } },
          status_history: {
            select: { status: true, reason: true, created_at: true },
            orderBy: { created_at: 'asc' },
          },
          review: { select: { stars: true, comment: true, created_at: true } },
        },
        orderBy: [
          ...(actorRole === UserRole.ADMIN ? [{ needs_attention: 'desc' as const }] : []),
          { created_at: 'desc' as const },
        ],
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single order by ID with ownership check
   */
  async getOrderById(orderId: string, actorId: string, actorRole: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { id: true, name_uz: true, name_ru: true, name_en: true, image_url: true } } } },
        shop: { select: { id: true, name: true, phone: true, logo_url: true, owner_id: true } },
        customer: { select: { id: true, name: true, phone: true } },
        status_history: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { created_at: 'asc' },
        },
        review: { select: { stars: true, comment: true, created_at: true } },
      },
    });

    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    // Ownership verification (Section 3)
    if (actorRole === UserRole.CUSTOMER && order.customer_id !== actorId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied: not your order.' });
    }

    if (actorRole === UserRole.SELLER && order.shop.owner_id !== actorId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied: order belongs to another shop.' });
    }

    return order;
  }

  /**
   * Seller accepts a new order
   */
  async acceptOrder(orderId: string, sellerId: string) {
    return this.transitionOrder(orderId, OrderStatus.ACCEPTED, sellerId, UserRole.SELLER);
  }

  /**
   * Seller rejects a new order (cancels with reason)
   */
  async rejectOrder(orderId: string, sellerId: string, dto: RejectOrderDto) {
    return this.transitionOrder(orderId, OrderStatus.CANCELLED, sellerId, UserRole.SELLER, dto.reason);
  }

  /**
   * Cancel an order (customer while new, seller with reason)
   */
  async cancelOrder(orderId: string, actorId: string, actorRole: UserRole, dto: CancelOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    if (actorRole === UserRole.CUSTOMER && order.status !== OrderStatus.NEW) {
      throw new ConflictException({
        code: ERROR_CODES.INVALID_STATUS_TRANSITION,
        message: 'Customers can only cancel orders while in "new" status.',
      });
    }

    return this.transitionOrder(orderId, OrderStatus.CANCELLED, actorId, actorRole, dto.reason || 'Cancelled');
  }

  /**
   * Seller updates order progression: on_the_way, delivered
   */
  async updateStatus(orderId: string, sellerId: string, dto: UpdateOrderStatusDto) {
    return this.transitionOrder(orderId, dto.status, sellerId, UserRole.SELLER);
  }

  /**
   * Core State Machine Engine enforcing transitions, stock restoration, and notifications
   */
  private async transitionOrder(
    orderId: string,
    targetStatus: OrderStatus,
    actorId: string,
    actorRole: UserRole,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shop: true,
      },
    });

    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    // Role ownership check
    if (actorRole === UserRole.SELLER && order.shop.owner_id !== actorId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Order belongs to another shop.' });
    }
    if (actorRole === UserRole.CUSTOMER && order.customer_id !== actorId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Order belongs to another customer.' });
    }

    const currentStatus = order.status as OrderStatus;
    const allowedTargets = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTargets.includes(targetStatus)) {
      throw new ConflictException({
        code: ERROR_CODES.INVALID_STATUS_TRANSITION,
        message: `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowedTargets.join(', ')}]`,
      });
    }

    // Check cancellation permissions
    if (targetStatus === OrderStatus.CANCELLED) {
      const allowedRoles = CANCELLATION_ALLOWED_ROLES[currentStatus] || [];
      if (!allowedRoles.includes(actorRole)) {
        throw new ConflictException({
          code: ERROR_CODES.INVALID_STATUS_TRANSITION,
          message: `Role '${actorRole}' is not authorized to cancel order from status '${currentStatus}'.`,
        });
      }

      if (actorRole === UserRole.SELLER && (!reason || reason.trim().length === 0)) {
        throw new BadRequestException({
          code: 'REASON_REQUIRED',
          message: 'A rejection/cancellation reason is strictly required.',
        });
      }
    }

    // Execute state transition atomically
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // If moving to CANCELLED, restore reserved stock for each item!
      if (targetStatus === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.product_id },
            data: {
              stock: { increment: item.quantity },
            },
          });
        }
      }

      const updateData: any = {
        status: targetStatus as any,
      };

      if (targetStatus === OrderStatus.ACCEPTED) {
        updateData.accepted_at = new Date();
      } else if (targetStatus === OrderStatus.DELIVERED) {
        updateData.delivered_at = new Date();
        // If cash, mark payment as paid upon delivery (Section 9)
        if (order.payment_method === PaymentMethod.CASH) {
          updateData.payment_status = PaymentStatus.PAID;
        }
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          items: true,
          shop: { select: { id: true, name: true, phone: true } },
          customer: { select: { id: true, name: true, phone: true } },
          status_history: true,
        },
      });

      // Write audit log to order_status_history
      await tx.orderStatusHistory.create({
        data: {
          order_id: orderId,
          status: targetStatus as any,
          changed_by: actorId,
          reason: reason || null,
        },
      });

      return updated;
    });

    // The order left 'new' (accepted or cancelled) before the auto-cancel job fired; drop it.
    if (currentStatus === OrderStatus.NEW) {
      await this.dropAutoCancel(orderId);
    }

    const timestamp = new Date().toISOString();

    // Broadcast Realtime Event
    this.notificationsGateway.broadcastOrderStatus(orderId, order.customer_id, targetStatus, timestamp);

    if (targetStatus === OrderStatus.CANCELLED) {
      this.notificationsGateway.broadcastOrderCancelled(order.shop_id, orderId, reason);
    }

    // Send Push Notification in recipient's language
    if (targetStatus === OrderStatus.CANCELLED) {
      if (actorRole === UserRole.CUSTOMER) {
        this.pushNotificationService.sendOrderStatusPush(order.shop.owner_id, OrderStatus.CANCELLED, orderId);
      } else {
        this.pushNotificationService.sendOrderStatusPush(order.customer_id, OrderStatus.CANCELLED, orderId);
      }
    } else {
      this.pushNotificationService.sendOrderStatusPush(order.customer_id, targetStatus, orderId);
    }

    return updatedOrder;
  }

  /**
   * Customer rates a delivered order once (1–5 stars, optional comment).
   * Stored in its own table so it never pollutes the status timeline.
   */
  async reviewOrder(orderId: string, customerId: string, dto: ReviewOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { review: true },
    });

    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }
    if (order.customer_id !== customerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You are not allowed to review this order' });
    }
    if (order.status !== (OrderStatus.DELIVERED as any)) {
      throw new BadRequestException({
        code: 'ORDER_NOT_DELIVERED',
        message: 'Only delivered orders can be reviewed.',
      });
    }
    if (order.review) {
      throw new ConflictException({ code: 'ALREADY_REVIEWED', message: 'This order has already been reviewed.' });
    }

    const comment = dto.comment?.trim();
    return this.prisma.orderReview.create({
      data: {
        order_id: orderId,
        customer_id: customerId,
        stars: dto.stars,
        comment: comment ? comment : null,
      },
    });
  }
}
