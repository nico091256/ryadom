import { OrderStatus, UserRole } from './enums';

// Distance & Geography
export const DEFAULT_SEARCH_RADIUS_METERS = 3000; // 3 km
export const TIYIN_PER_UZS = 100;

// Timeouts
export const ORDER_ACCEPTANCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const SMS_EXPIRATION_SECONDS = 120; // 2 minutes
export const MAX_SMS_ATTEMPTS = 5;

// Allowed status transitions as mandated by the Technical Specification (Section 7)
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED],
  [OrderStatus.ON_THE_WAY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

// Roles allowed to cancel at specific statuses
export const CANCELLATION_ALLOWED_ROLES: Record<OrderStatus, UserRole[]> = {
  [OrderStatus.NEW]: [UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN],
  [OrderStatus.ACCEPTED]: [UserRole.SELLER, UserRole.ADMIN],
  [OrderStatus.PREPARING]: [UserRole.SELLER, UserRole.ADMIN],
  [OrderStatus.ON_THE_WAY]: [],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

// WebSocket Event Names
export const SOCKET_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_STATUS: 'order:status',
  JOIN_SHOP_ROOM: 'join:shop',
  LEAVE_SHOP_ROOM: 'leave:shop',
  JOIN_ORDER_ROOM: 'join:order',
  LEAVE_ORDER_ROOM: 'leave:order',
} as const;

// Error Codes
export const ERROR_CODES = {
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  ORDER_ALREADY_ACCEPTED: 'ORDER_ALREADY_ACCEPTED',
  UNAUTHORIZED_ROLE: 'UNAUTHORIZED_ROLE',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  CART_MULTIPLE_SHOPS: 'CART_MULTIPLE_SHOPS',
  SHOP_CLOSED: 'SHOP_CLOSED',
  SHOP_INACTIVE: 'SHOP_INACTIVE',
  USER_BLOCKED: 'USER_BLOCKED',
  INVALID_SMS_CODE: 'INVALID_SMS_CODE',
  SMS_CODE_EXPIRED: 'SMS_CODE_EXPIRED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  MUST_CHANGE_PASSWORD: 'MUST_CHANGE_PASSWORD',
} as const;
