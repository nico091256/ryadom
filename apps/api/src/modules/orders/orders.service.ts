import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationService } from '../notifications/push-notification.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto, RejectOrderDto, CancelOrderDto, UpdateOrderStatusDto } from './orders.dto';
import {
  ALLOWED_STATUS_TRANSITIONS,
  CANCELLATION_ALLOWED_ROLES,
  ERROR_CODES,
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
    if (!shop.is_active || !shop.is_open) {
      throw new ConflictException({
        code: ERROR_CODES.SHOP_CLOSED,
        message: 'This shop is currently closed or inactive. Orders cannot be accepted.',
      });
    }

    // Perform atomic transaction: check & decrement stock, create order, clear cart
    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Validate and decrement stock
      let totalAmount = 0;
      for (const item of cart.items) {
        const product = await tx.product.findUnique({
          where: { id: item.product_id },
        });

        if (!product || product.deleted_at || !product.is_available) {
          throw new ConflictException({
            code: ERROR_CODES.OUT_OF_STOCK,
            message: `Product '${item.product.name_uz}' is no longer available.`,
          });
        }

        if (product.stock < item.quantity) {
          throw new ConflictException({
            code: ERROR_CODES.OUT_OF_STOCK,
            message: `Insufficient stock for product '${product.name_uz}'. Requested: ${item.quantity}, Available: ${product.stock}`,
          });
        }

        totalAmount += product.price * item.quantity;

        // Decrement stock
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: product.stock - item.quantity,
          },
        });
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
    });

    // 6. Broadcast Realtime Socket.IO event to Seller Room
    this.notificationsGateway.broadcastNewOrder(shop.id, order);

    // 7. Dispatch High-Priority Push Notification to Seller
    const formattedTotal = formatPrice(order.total_amount);
    this.pushNotificationService.sendNewOrderSellerPush(shop.owner_id, order.id, formattedTotal);

    return order;
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

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: { include: { product: { select: { id: true, name_uz: true, name_ru: true, name_en: true, image_url: true } } } },
          shop: { select: { id: true, name: true, phone: true, logo_url: true } },
          customer: { select: { id: true, name: true, phone: true } },
          status_history: { orderBy: { created_at: 'asc' } },
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
   * Seller updates order progression: preparing, on_the_way, delivered
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
   * 5-Minute Escalation Background Check (Section 7 & Milestone 3)
   * Finds orders where status = 'new' and created_at > 5 minutes ago and needs_attention = false.
   * Sets needs_attention = true so Admin panel displays them at the top.
   */
  async checkOrderAcceptanceTimeouts() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const timedOutOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.NEW as any,
        needs_attention: false,
        created_at: { lte: fiveMinutesAgo },
      },
    });

    if (timedOutOrders.length > 0) {
      this.logger.warn(`Found ${timedOutOrders.length} unaccepted orders exceeding 5-minute timeout. Flagging for admin attention.`);
      await this.prisma.order.updateMany({
        where: {
          id: { in: timedOutOrders.map((o) => o.id) },
        },
        data: {
          needs_attention: true,
        },
      });
    }
  }
}
