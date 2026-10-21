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
  cors: { origin: '*' },
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

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.debug(`Anonymous client connected: ${client.id}`);
        return;
      }

      const payload = this.jwtService.verify(token, { secret: getJwtAccessSecret(this.configService) });
      client.data.user = payload;

      // Automatically join user room
      client.join(`user:${payload.sub}`);

      this.logger.log(`Client authenticated: ${client.id} (User: ${payload.sub}, Role: ${payload.role})`);
    } catch (err: any) {
      this.logger.warn(`Client connection auth failed: ${err.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  private currentUser(client: Socket): SocketUser | null {
    const u = client.data?.user;
    return u && typeof u.sub === 'string' ? (u as SocketUser) : null;
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
