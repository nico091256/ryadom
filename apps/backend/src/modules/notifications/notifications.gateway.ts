import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SOCKET_EVENTS, UserRole } from '@localshop/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getJwtAccessSecret } from '../../common/config/jwt-secret';

interface SocketUser {
  sub: string;
  role: UserRole | string;
}

/** Per-socket state we keep besides the user: the timer that cuts the connection when its token expires. */
interface SocketData {
  user?: SocketUser;
  expiryTimer?: ReturnType<typeof setTimeout>;
}

/** Node's setTimeout overflows (fires immediately) above 2^31-1 ms. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function parseCorsOrigins(raw: string | undefined): string[] | null {
  const list = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

/**
 * Socket.IO CORS origin check, mirroring the HTTP one in main.ts. Evaluated per
 * handshake (not when the decorator runs) because ConfigModule only loads .env
 * into process.env after this file has been imported. With CORS_ORIGINS unset
 * (development) the request origin is reflected, exactly like `origin: true`.
 */
export function socketCorsOrigin(
  requestOrigin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  const allowed = parseCorsOrigins(process.env.CORS_ORIGINS);
  if (!allowed) return callback(null, true);
  callback(null, !!requestOrigin && allowed.includes(requestOrigin));
}

type JoinResult = { event: 'joined'; room: string } | { event: 'error'; code: string; message: string };

const UNAUTHORIZED: JoinResult = {
  event: 'error',
  code: 'UNAUTHORIZED',
  message: 'Authenticate the socket (handshake auth.token) before joining rooms.',
};
const FORBIDDEN: JoinResult = {
  event: 'error',
  code: 'FORBIDDEN',
  message: 'You are not allowed to join this room.',
};
const BAD_REQUEST: JoinResult = {
  event: 'error',
  code: 'BAD_REQUEST',
  message: 'Expected a non-empty id string.',
};

@WebSocketGateway({
  cors: { origin: socketCorsOrigin },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Token from `handshake.auth.token` (Socket.IO's auth payload) or an
   * Authorization header. Never from the query string: URLs end up in access
   * logs, proxies and browser history.
   */
  private extractToken(client: Socket): string | undefined {
    const fromAuth = client.handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
      const value = header.replace(/^Bearer\s+/i, '').trim();
      if (value) return value;
    }
    return undefined;
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.debug(`Anonymous client connected: ${client.id}`);
        return;
      }

      const payload = this.jwtService.verify<{ sub?: unknown; exp?: unknown }>(token, {
        secret: getJwtAccessSecret(this.configService),
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string') {
        // Stays connected but anonymous (same as a bad/expired token): the
        // client sees UNAUTHORIZED on its first join and reconnects with a fresh token.
        this.logger.warn(`Socket ${client.id} presented a token without a subject`);
        return;
      }

      // The JWT only says who the user was when it was signed; blocked / deleted
      // accounts must not keep a live feed, and the role comes from the DB too.
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, is_blocked: true },
      });
      if (!user || user.is_blocked) {
        this.logger.warn(`Socket ${client.id} refused: user ${payload.sub} ${user ? 'is blocked' : 'does not exist'}`);
        client.disconnect(true);
        return;
      }

      const data = client.data as SocketData;
      data.user = { sub: user.id, role: user.role };
      this.scheduleExpiry(client, payload.exp);

      // Automatically join user room
      client.join(`user:${user.id}`);

      this.logger.log(`Client authenticated: ${client.id} (User: ${user.id}, Role: ${user.role})`);
    } catch (err: any) {
      // Invalid / expired token: the socket stays anonymous (no rooms). The store
      // panel and the mobile app rely on the UNAUTHORIZED join ack to reconnect.
      this.logger.warn(`Client connection auth failed: ${err.message}`);
    }
  }

  /**
   * A socket authenticated with a 15-minute access token must not outlive it:
   * when `exp` passes the client is cut and has to reconnect with a fresh token
   * (the store panel and the mobile app already do that on token refresh).
   */
  private scheduleExpiry(client: Socket, exp: unknown) {
    if (typeof exp !== 'number') return;
    const data = client.data as SocketData;
    const msLeft = exp * 1000 - Date.now();
    if (msLeft <= 0) {
      client.disconnect(true);
      return;
    }
    const timer = setTimeout(() => {
      this.logger.debug(`Socket ${client.id} access token expired; disconnecting`);
      client.disconnect(true);
    }, Math.min(msLeft, MAX_TIMEOUT_MS));
    timer.unref?.();
    data.expiryTimer = timer;
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketData | undefined;
    if (data?.expiryTimer) {
      clearTimeout(data.expiryTimer);
      data.expiryTimer = undefined;
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  private currentUser(client: Socket): SocketUser | null {
    const u = (client.data as SocketData | undefined)?.user;
    return u && typeof u.sub === 'string' ? u : null;
  }

  /**
   * Shop rooms receive full order payloads (customer phone, address, items), so
   * only the shop owner or a platform admin may subscribe.
   */
  @SubscribeMessage(SOCKET_EVENTS.JOIN_SHOP_ROOM)
  async handleJoinShop(client: Socket, shopId: unknown): Promise<JoinResult> {
    if (typeof shopId !== 'string' || !shopId.trim()) return BAD_REQUEST;
    const user = this.currentUser(client);
    if (!user) return UNAUTHORIZED;

    if (user.role !== UserRole.ADMIN) {
      if (user.role !== UserRole.SELLER) return FORBIDDEN;
      const shop = await this.prisma.shop.findUnique({ where: { id: shopId }, select: { owner_id: true } });
      if (!shop || shop.owner_id !== user.sub) {
        this.logger.warn(`Socket ${client.id} (user ${user.sub}) refused for room shop:${shopId}`);
        return FORBIDDEN;
      }
    }

    client.join(`shop:${shopId}`);
    this.logger.log(`Socket ${client.id} joined room shop:${shopId}`);
    return { event: 'joined', room: `shop:${shopId}` };
  }

  /**
   * Order rooms are limited to the order's customer, the fulfilling shop's owner
   * and platform admins.
   */
  @SubscribeMessage(SOCKET_EVENTS.JOIN_ORDER_ROOM)
  async handleJoinOrder(client: Socket, orderId: unknown): Promise<JoinResult> {
    if (typeof orderId !== 'string' || !orderId.trim()) return BAD_REQUEST;
    const user = this.currentUser(client);
    if (!user) return UNAUTHORIZED;

    if (user.role !== UserRole.ADMIN) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { customer_id: true, shop: { select: { owner_id: true } } },
      });
      const allowed =
        !!order &&
        ((user.role === UserRole.CUSTOMER && order.customer_id === user.sub) ||
          (user.role === UserRole.SELLER && order.shop?.owner_id === user.sub));
      if (!allowed) {
        this.logger.warn(`Socket ${client.id} (user ${user.sub}) refused for room order:${orderId}`);
        return FORBIDDEN;
      }
    }

    client.join(`order:${orderId}`);
    this.logger.log(`Socket ${client.id} joined room order:${orderId}`);
    return { event: 'joined', room: `order:${orderId}` };
  }

  // Gateway Broadcast Methods
  broadcastNewOrder(shopId: string, order: any) {
    this.logger.log(`Emitting [${SOCKET_EVENTS.ORDER_NEW}] to room shop:${shopId}`);
    this.server.to(`shop:${shopId}`).emit(SOCKET_EVENTS.ORDER_NEW, order);
  }

  broadcastOrderCancelled(shopId: string, orderId: string, reason?: string) {
    this.logger.log(`Emitting [${SOCKET_EVENTS.ORDER_CANCELLED}] to room shop:${shopId}`);
    this.server.to(`shop:${shopId}`).emit(SOCKET_EVENTS.ORDER_CANCELLED, { orderId, reason });
  }

  broadcastOrderStatus(orderId: string, customerId: string, status: string, timestamp: string) {
    const payload = { orderId, status, timestamp };
    this.logger.log(`Emitting [${SOCKET_EVENTS.ORDER_STATUS}] for order ${orderId} (${status})`);
    this.server.to(`order:${orderId}`).emit(SOCKET_EVENTS.ORDER_STATUS, payload);
    this.server.to(`user:${customerId}`).emit(SOCKET_EVENTS.ORDER_STATUS, payload);
  }
}
