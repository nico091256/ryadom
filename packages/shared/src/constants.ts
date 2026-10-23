import { OrderStatus, UserRole } from './enums';

// Distance & Geography
export const DEFAULT_SEARCH_RADIUS_METERS = 3000; // 3 km
export const TIYIN_PER_UZS = 100;

// Timeouts
export const ORDER_ACCEPTANCE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const SMS_EXPIRATION_SECONDS = 120; // 2 minutes
export const MAX_SMS_ATTEMPTS = 5;
export const IDEMPOTENCY_KEY_TTL_SECONDS = 24 * 60 * 60; // 24 hours (cached response)
export const IDEMPOTENCY_PROCESSING_TTL_SECONDS = 60; // in-flight claim; released sooner on failure
export const REFRESH_TOKEN_TTL_DAYS = 30;

// Money: all amounts are integer tiyin stored in Postgres int4.
export const MAX_ORDER_TOTAL_TIYIN = 2_147_483_647;
export const MAX_PRODUCT_PRICE_TIYIN = 1_000_000_000; // 10 mln so'm
export const MAX_PRODUCT_STOCK = 1_000_000;

// Allowed status transitions: NEW -> ACCEPTED -> ON_THE_WAY -> DELIVERED (+ cancellations)
// Cancelling from ON_THE_WAY is reserved to admins (support cases), see CANCELLATION_ALLOWED_ROLES.
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED],
  [OrderStatus.ON_THE_WAY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

// Roles allowed to cancel at specific statuses
export const CANCELLATION_ALLOWED_ROLES: Record<OrderStatus, UserRole[]> = {
  [OrderStatus.NEW]: [UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN],
  [OrderStatus.ACCEPTED]: [UserRole.SELLER, UserRole.ADMIN],
  [OrderStatus.ON_THE_WAY]: [UserRole.ADMIN],
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
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  SHOP_NOT_APPROVED: 'SHOP_NOT_APPROVED',
  ONLINE_PAYMENTS_DISABLED: 'ONLINE_PAYMENTS_DISABLED',
  ORDER_TOTAL_TOO_LARGE: 'ORDER_TOTAL_TOO_LARGE',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
} as const;
