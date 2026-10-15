/// Mirrors packages/shared/src/enums.ts. Keep the two files in sync by hand —
/// nothing regenerates this automatically.
library;

enum UserRole {
  customer('customer'),
  seller('seller'),
  admin('admin');

  const UserRole(this.value);
  final String value;

  static UserRole fromValue(String value) => UserRole.values.firstWhere(
        (e) => e.value == value,
        orElse: () => throw ArgumentError('Unknown UserRole: $value'),
      );
}

/// `new` is a reserved word in Dart, so the NEW status is named [newOrder]
/// here; its wire value (and JSON representation) is still exactly 'new'.
enum OrderStatus {
  newOrder('new'),
  accepted('accepted'),
  onTheWay('on_the_way'),
  delivered('delivered'),
  cancelled('cancelled');

  const OrderStatus(this.value);
  final String value;

  static OrderStatus fromValue(String value) => OrderStatus.values.firstWhere(
        (e) => e.value == value,
        orElse: () => throw ArgumentError('Unknown OrderStatus: $value'),
      );
}

enum PaymentMethod {
  cash('cash'),
  online('online');

  const PaymentMethod(this.value);
  final String value;

  static PaymentMethod fromValue(String value) => PaymentMethod.values.firstWhere(
        (e) => e.value == value,
        orElse: () => throw ArgumentError('Unknown PaymentMethod: $value'),
      );
}

enum PaymentStatus {
  pending('pending'),
  paid('paid'),
  refunded('refunded'),
  failed('failed');

  const PaymentStatus(this.value);
  final String value;

  static PaymentStatus fromValue(String value) => PaymentStatus.values.firstWhere(
        (e) => e.value == value,
        orElse: () => throw ArgumentError('Unknown PaymentStatus: $value'),
      );
}

enum SupportedLanguage {
  uz('uz'),
  ru('ru'),
  en('en');

  const SupportedLanguage(this.value);
  final String value;

  static SupportedLanguage fromValue(String value) => SupportedLanguage.values.firstWhere(
        (e) => e.value == value,
        orElse: () => throw ArgumentError('Unknown SupportedLanguage: $value'),
      );
}

enum OnlinePaymentProvider {
  payme('payme'),
  click('click');

  const OnlinePaymentProvider(this.value);
  final String value;
}

enum ShopStatus {
  pending('pending'),
  active('active'),
  blocked('blocked');

  const ShopStatus(this.value);
  final String value;

  static ShopStatus fromValue(String value) => ShopStatus.values.firstWhere(
        (e) => e.value == value,
        orElse: () => throw ArgumentError('Unknown ShopStatus: $value'),
      );
}

enum DevicePlatform {
  android('android'),
  ios('ios'),
  web('web'),
  unknown('unknown');

  const DevicePlatform(this.value);
  final String value;
}
