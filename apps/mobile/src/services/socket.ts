import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, mobileApi } from './api';
import { SOCKET_EVENTS } from '@localshop/shared';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) {
    return socket;
  }

  const token = await mobileApi.getToken();

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected to backend gateway');
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Disconnected: ${reason}`);
  });

  return socket;
}

export function joinShopRoom(shopId: string) {
  if (socket) {
    socket.emit(SOCKET_EVENTS.JOIN_SHOP_ROOM, shopId);
  }
}

export function joinOrderRoom(orderId: string) {
  if (socket) {
    socket.emit(SOCKET_EVENTS.JOIN_ORDER_ROOM, orderId);
  }
}
