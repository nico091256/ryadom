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
import { SOCKET_EVENTS } from '@localshop/shared';

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

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET', 'super-secret-jwt-access-key-minimum-32-chars-long');
      const payload = this.jwtService.verify(token, { secret });
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

  @SubscribeMessage(SOCKET_EVENTS.JOIN_SHOP_ROOM)
  handleJoinShop(client: Socket, shopId: string) {
    client.join(`shop:${shopId}`);
    this.logger.log(`Socket ${client.id} joined room shop:${shopId}`);
    return { event: 'joined', room: `shop:${shopId}` };
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ORDER_ROOM)
  handleJoinOrder(client: Socket, orderId: string) {
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
