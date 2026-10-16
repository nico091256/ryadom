import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderStatus } from '@localshop/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationService } from '../notifications/push-notification.service';
import { ORDER_AUTO_CANCEL_QUEUE } from './orders.constants';

export interface OrderAutoCancelJobData {
  orderId: string;
}

/**
 * Hard auto-cancel for orders a seller never accepted within the acceptance
 * window (spec: 10 minutes). Scheduled as a delayed BullMQ job on order
 * creation; re-checks the current status before acting, since the order may
 * have already been accepted/cancelled by the time this job fires.
 */
@Injectable()
@Processor(ORDER_AUTO_CANCEL_QUEUE)
export class OrderAutoCancelProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderAutoCancelProcessor.name);

  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway,
    private pushNotificationService: PushNotificationService,
  ) {
    super();
  }

  async process(job: Job<OrderAutoCancelJobData>): Promise<void> {
    const { orderId } = job.data;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shop: true },
    });

    if (!order || order.status !== (OrderStatus.NEW as any)) {
      // Already accepted/cancelled/delivered by the time this job fired — nothing to do.
      return;
    }

    const cancelReason = "Avtomatik bekor qilindi: do'kon belgilangan vaqtda qabul qilmadi";

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.NEW as any },
        data: { status: OrderStatus.CANCELLED as any, needs_attention: true },
      });
      if (res.count === 0) return;

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
          changed_by: order.customer_id,
          reason: cancelReason,
        },
      });
    });

    this.logger.warn(`Order ${orderId} auto-cancelled: not accepted within the acceptance window.`);

    const timestamp = new Date().toISOString();
    this.notificationsGateway.broadcastOrderStatus(orderId, order.customer_id, OrderStatus.CANCELLED, timestamp);
    this.notificationsGateway.broadcastOrderCancelled(order.shop_id, orderId, cancelReason);
    this.pushNotificationService.sendOrderStatusPush(order.customer_id, OrderStatus.CANCELLED, orderId);
    this.pushNotificationService.sendOrderStatusPush(order.shop.owner_id, OrderStatus.CANCELLED, orderId);
  }
}
