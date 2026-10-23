/// Mirrors packages/shared/src/constants.ts. Keep the two files in sync by
/// hand — nothing regenerates this automatically.
library;

import 'enums.dart';

// Distance & Geography
const int defaultSearchRadiusMeters = 3000; // 3 km
const int tiyinPerUzs = 100;

// Timeouts
const Duration orderAcceptanceTimeout = Duration(minutes: 10);
const Duration smsExpiration = Duration(seconds: 120);
const int maxSmsAttempts = 5;
const Duration idempotencyKeyTtl = Duration(hours: 24);
const Duration idempotencyProcessingTtl = Duration(seconds: 60);
const int refreshTokenTtlDays = 30;

// Money: all amounts are integer tiyin stored in Postgres int4.
const int maxOrderTotalTiyin = 2147483647;
const int maxProductPriceTiyin = 1000000000; // 10 mln so'm
const int maxProductStock = 1000000;

/// Allowed status transitions: NEW -> ACCEPTED -> ON_THE_WAY -> DELIVERED
/// (+ cancellations). Must match packages/shared/src/constants.ts exactly.
/// Cancelling from ON_THE_WAY is reserved to admins (support cases).
const Map<OrderStatus, List<OrderStatus>> allowedStatusTransitions = {
  OrderStatus.newOrder: [OrderStatus.accepted, OrderStatus.cancelled],
  OrderStatus.accepted: [OrderStatus.onTheWay, OrderStatus.cancelled],
  OrderStatus.onTheWay: [OrderStatus.delivered, OrderStatus.cancelled],
  OrderStatus.delivered: [],
  OrderStatus.cancelled: [],
};

/// Roles allowed to cancel an order at each status.
const Map<OrderStatus, List<UserRole>> cancellationAllowedRoles = {
  OrderStatus.newOrder: [UserRole.customer, UserRole.seller, UserRole.admin],
  OrderStatus.accepted: [UserRole.seller, UserRole.admin],
  OrderStatus.onTheWay: [UserRole.admin],
  OrderStatus.delivered: [],
  OrderStatus.cancelled: [],
};

/// Socket.IO event names (must match @localshop/shared's SOCKET_EVENTS).
class SocketEvents {
  SocketEvents._();

  static const orderNew = 'order:new';
  static const orderCancelled = 'order:cancelled';
  static const orderStatus = 'order:status';
  static const joinShopRoom = 'join:shop';
  static const leaveShopRoom = 'leave:shop';
  static const joinOrderRoom = 'join:order';
  static const leaveOrderRoom = 'leave:order';
}

/// Business error codes returned by the API's { error: { code, message } }
/// envelope (must match @localshop/shared's ERROR_CODES).
class ErrorCodes {
  ErrorCodes._();

  static const invalidStatusTransition = 'INVALID_STATUS_TRANSITION';
  static const orderAlreadyAccepted = 'ORDER_ALREADY_ACCEPTED';
  static const unauthorizedRole = 'UNAUTHORIZED_ROLE';
  static const outOfStock = 'OUT_OF_STOCK';
  static const cartMultipleShops = 'CART_MULTIPLE_SHOPS';
  static const shopClosed = 'SHOP_CLOSED';
  static const shopInactive = 'SHOP_INACTIVE';
  static const userBlocked = 'USER_BLOCKED';
  static const invalidSmsCode = 'INVALID_SMS_CODE';
  static const smsCodeExpired = 'SMS_CODE_EXPIRED';
  static const tooManyAttempts = 'TOO_MANY_ATTEMPTS';
  static const mustChangePassword = 'MUST_CHANGE_PASSWORD';
  static const duplicateRequest = 'DUPLICATE_REQUEST';
  static const invalidRefreshToken = 'INVALID_REFRESH_TOKEN';
  static const shopNotApproved = 'SHOP_NOT_APPROVED';
  static const onlinePaymentsDisabled = 'ONLINE_PAYMENTS_DISABLED';
  static const orderTotalTooLarge = 'ORDER_TOTAL_TOO_LARGE';
  static const idempotencyKeyReused = 'IDEMPOTENCY_KEY_REUSED';
}
