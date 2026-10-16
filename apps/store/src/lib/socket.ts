'use client';

import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN, api } from './api';

export const SOCKET_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_STATUS: 'order:status',
  JOIN_SHOP_ROOM: 'join:shop',
} as const;

let socket: Socket | null = null;
let joinedShopId: string | null = null;

/**
 * Lazy singleton connected to the API origin (default namespace) with the current access token.
 * Re-joins the shop room on every (re)connect.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API_ORIGIN, {
    auth: (cb) => cb({ token: api.getToken() ?? '' }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  socket.on('connect', () => {
    if (joinedShopId) socket?.emit(SOCKET_EVENTS.JOIN_SHOP_ROOM, joinedShopId);
  });
  return socket;
}

/** Joins `shop:<shopId>` now (if connected) and on every future reconnect. */
export function joinShopRoom(shopId: string): void {
  joinedShopId = shopId;
  const s = getSocket();
  if (s.connected) s.emit(SOCKET_EVENTS.JOIN_SHOP_ROOM, shopId);
}

export function disconnectSocket(): void {
  joinedShopId = null;
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
