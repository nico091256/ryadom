export enum UserRole {
  CUSTOMER = 'customer',
  SELLER = 'seller',
  ADMIN = 'admin',
}

export enum OrderStatus {
  NEW = 'new',
  ACCEPTED = 'accepted',
  ON_THE_WAY = 'on_the_way',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  ONLINE = 'online',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export enum SupportedLanguage {
  UZ = 'uz',
  RU = 'ru',
  EN = 'en',
}

export enum OnlinePaymentProvider {
  PAYME = 'payme',
  CLICK = 'click',
}

export enum ShopStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web',
  UNKNOWN = 'unknown',
}
