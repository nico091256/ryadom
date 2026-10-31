import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { POS_WEBHOOK_EVENT_HEADER, POS_WEBHOOK_SIGNATURE_HEADER } from './pos.constants';

const WEBHOOK_TIMEOUT_MS = 5000;

/** Hostnames / ranges a user-supplied webhook may never point at (SSRF into our own network). */
const PRIVATE_IPV4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/** Only public http(s) targets; private/loopback/link-local/internal names are rejected. */
export function isSafeWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false;
  if (host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return false;
  if (PRIVATE_IPV4.test(host)) return false;
  return true;
}

export interface WebhookOrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

/** What a POS receives for `order.created` — the shop-side view of an order, no customer ids. */
export interface WebhookOrderPayload {
  id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total_amount: number;
  discount_amount: number;
  promo_code: string | null;
  comment: string | null;
  customer_phone: string;
  customer_name: string | null;
  address: unknown;
  items: WebhookOrderItem[];
  created_at: string;
}

/**
 * Pushes order events to the shop's cash-register webhook (`pos_webhook_url`).
 *
 * Fire-and-forget by design: an unreachable POS must never fail or slow down
 * checkout. The body is signed with HMAC-SHA256 using the shop's POS API key so
 * the receiver can verify the sender (`X-Ryadom-Signature: sha256=<hex>`).
 */
@Injectable()
export class PosWebhookService {
  private readonly logger = new Logger(PosWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Shapes the order row (with items) into the payload a POS receives. */
  static toOrderPayload(order: any): WebhookOrderPayload {
    return {
      id: order.id,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      total_amount: order.total_amount,
      discount_amount: order.discount_amount ?? 0,
      promo_code: order.promo_code ?? null,
      comment: order.comment ?? null,
      customer_phone: order.customer_phone,
      customer_name: order.customer?.name ?? null,
      address: order.address_snapshot ?? null,
      items: (order.items ?? []).map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        unit_price: i.unit_price,
        quantity: i.quantity,
      })),
      created_at: order.created_at instanceof Date ? order.created_at.toISOString() : String(order.created_at),
    };
  }

  /** Called right after an order is committed. Never throws, never awaited by the caller. */
  dispatchNewOrder(shopId: string, order: any): void {
    void this.send(shopId, 'order.created', PosWebhookService.toOrderPayload(order)).catch((err: any) => {
      this.logger.warn(`POS webhook for shop ${shopId} failed: ${err?.message ?? err}`);
    });
  }

  private async send(shopId: string, event: string, data: unknown): Promise<void> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { pos_webhook_url: true, pos_api_key: true, pos_type: true },
    });
    const url = shop?.pos_webhook_url?.trim();
    if (!url) return;
    if (!isSafeWebhookUrl(url)) {
      this.logger.warn(`POS webhook for shop ${shopId} skipped: unsafe url`);
      return;
    }

    const body = JSON.stringify({
      event,
      shop_id: shopId,
      pos_type: shop!.pos_type,
      sent_at: new Date().toISOString(),
      data,
    });
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'Ryadom-Webhook/1.0',
      [POS_WEBHOOK_EVENT_HEADER]: event,
    };
    if (shop!.pos_api_key) {
      headers[POS_WEBHOOK_SIGNATURE_HEADER] = `sha256=${createHmac('sha256', shop!.pos_api_key).update(body).digest('hex')}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`POS webhook for shop ${shopId} answered HTTP ${res.status}`);
      } else {
        this.logger.debug(`POS webhook ${event} delivered to shop ${shopId}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
