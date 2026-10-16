'use client';

import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN, TOKEN_REFRESHED_EVENT, api } from './api';

export const SOCKET_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_STATUS: 'order:status',
  JOIN_SHOP_ROOM: 'join:shop',
} as const;

type JoinAck = { event: 'joined'; room: string } | { event: 'error'; code: string; message?: string };

let socket: Socket | null = null;
let joinedShopId: string | null = null;
let refreshListenerBound = false;

function emitJoin(s: Socket, shopId: string) {
  s.emit(SOCKET_EVENTS.JOIN_SHOP_ROOM, shopId, (ack: JoinAck | undefined) => {
    if (ack && ack.event === 'error') {
      // The gateway authenticates at connect time; an UNAUTHORIZED ack means we connected
      // with a missing/expired token. Reconnect once so the handshake picks up the current one.
      // eslint-disable-next-line no-console
      console.warn(`[socket] join:shop refused (${ack.code})`);
      if (ack.code === 'UNAUTHORIZED' && api.getToken()) reconnect();
    }
  });
}

/** Drop the current connection and open a new one with the token currently in storage. */
function reconnect() {
  if (!socket) return;
  socket.disconnect();
  socket.connect();
}

/**
 * Lazy singleton connected to the API origin (default namespace) with the current access token.
 * Re-joins the shop room on every (re)connect and re-authenticates after a token refresh.
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
    if (joinedShopId && socket) emitJoin(socket, joinedShopId);
  });
  if (!refreshListenerBound && typeof window !== 'undefined') {
    refreshListenerBound = true;
    window.addEventListener(TOKEN_REFRESHED_EVENT, () => {
      if (socket?.connected) reconnect();
    });
  }
  return socket;
}

/** Joins `shop:<shopId>` now (if connected) and on every future reconnect. */
export function joinShopRoom(shopId: string): void {
  joinedShopId = shopId;
  const s = getSocket();
  if (s.connected) emitJoin(s, shopId);
}

export function disconnectSocket(): void {
  joinedShopId = null;
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
