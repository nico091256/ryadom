import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job } from 'bullmq';
import { ORDER_ACCEPTANCE_TIMEOUT_MS, OrderStatus } from '@localshop/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationService } from '../notifications/push-notification.service';
import { ORDER_AUTO_CANCEL_QUEUE } from './orders.constants';

export interface OrderAutoCancelJobData {
  orderId: string;
}

/** How many stale `new` orders one sweep pass handles at most. */
export const STALE_ORDER_SWEEP_BATCH = 100;

export const AUTO_CANCEL_REASON = "Avtomatik bekor qilindi: do'kon belgilangan vaqtda qabul qilmadi";

/**
 * Hard auto-cancel for orders a seller never accepted within the acceptance
 * window (spec: 10 minutes). Two triggers share one implementation:
 *  - the delayed BullMQ job scheduled on order creation (primary path);
 *  - a per-minute sweep over `new` orders older than the window, which covers
 *    orders whose job was never enqueued (Redis offline at creation time).
 * Both re-check the current status with a conditional update before acting, so
 * the two paths (and a concurrent seller accept/cancel) can never double-restore stock.
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
    await this.cancelIfStillNew(job.data.orderId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OrderAutoCancelJobData> | undefined, err: Error): void {
    this.logger.error(
      `Auto-cancel job ${job?.id ?? '?'} for order ${job?.data?.orderId ?? '?'} failed ` +
        `(attempt ${job?.attemptsMade ?? '?'}/${job?.opts?.attempts ?? '?'}): ${err?.message ?? err}`,
    );
  }

  /**
   * Safety net for the Redis-offline gap: any order still `new` past the acceptance
   * window is cancelled here even if its delayed job never made it into the queue.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepStaleNewOrders(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ORDER_ACCEPTANCE_TIMEOUT_MS);
    const stale = await this.prisma.order.findMany({
      where: { status: OrderStatus.NEW as any, created_at: { lt: cutoff } },
      select: { id: true },
      orderBy: { created_at: 'asc' },
      take: STALE_ORDER_SWEEP_BATCH,
    });
    if (stale.length === 0) return 0;

    this.logger.warn(`Stale-order sweep found ${stale.length} unaccepted order(s) past the acceptance window.`);
    let cancelled = 0;
    for (const { id } of stale) {
      try {
        if (await this.cancelIfStillNew(id)) cancelled++;
      } catch (err: any) {
        // One bad order must not stop the rest of the batch; the next tick retries it.
        this.logger.error(`Stale-order sweep failed for order ${id}: ${err?.message ?? err}`);
      }
    }
    return cancelled;
  }

  /** Cancels the order if (and only if) it is still `new`. Returns true when this call did the cancel. */
  private async cancelIfStillNew(orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shop: true },
    });

    if (!order || order.status !== (OrderStatus.NEW as any)) {
      // Already accepted/cancelled/delivered by the time this fired — nothing to do.
      return false;
    }

    const didCancel = await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.NEW as any },
        data: { status: OrderStatus.CANCELLED as any, needs_attention: true },
      });
      if (res.count === 0) return false;

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock: { increment: item.quantity } },
        });
      }
      if (order.promo_code) {
        await tx.promoCode.updateMany({
          where: { code: order.promo_code, usage_count: { gt: 0 } },
          data: { usage_count: { decrement: 1 } },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          order_id: orderId,
          status: OrderStatus.CANCELLED as any,
          changed_by: null, // system action, no user behind it
          reason: AUTO_CANCEL_REASON,
        },
      });
      return true;
    });

    if (!didCancel) return false;

    this.logger.warn(`Order ${orderId} auto-cancelled: not accepted within the acceptance window.`);

    const timestamp = new Date().toISOString();
    this.notificationsGateway.broadcastOrderStatus(orderId, order.customer_id, OrderStatus.CANCELLED, timestamp);
    this.notificationsGateway.broadcastOrderCancelled(order.shop_id, orderId, AUTO_CANCEL_REASON);
    this.pushNotificationService.sendOrderStatusPush(order.customer_id, OrderStatus.CANCELLED, orderId);
    this.pushNotificationService.sendOrderStatusPush(order.shop.owner_id, OrderStatus.CANCELLED, orderId);
    return true;
  }
}
