import 'package:localshop_shared/localshop_shared.dart';

class OrderItem {
  const OrderItem({
    this.productId,
    required this.productName,
    required this.unitPrice,
    required this.quantity,
  });

  final String? productId;
  final String productName;
  final int unitPrice;
  final int quantity;

  int get subtotal => unitPrice * quantity;

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        productId: json['product_id'] as String?,
        productName: json['product_name'] as String,
        unitPrice: (json['unit_price'] as num).toInt(),
        quantity: (json['quantity'] as num).toInt(),
      );
}

class OrderStatusEvent {
  const OrderStatusEvent({required this.status, required this.reason, required this.createdAt});

  final OrderStatus status;
  final String? reason;
  final DateTime createdAt;

  factory OrderStatusEvent.fromJson(Map<String, dynamic> json) => OrderStatusEvent(
        status: OrderStatus.fromValue(json['status'] as String),
        reason: json['reason'] as String?,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

/// Customer rating of a delivered order (one per order).
class OrderReview {
  const OrderReview({required this.stars, this.comment});

  final int stars;
  final String? comment;

  factory OrderReview.fromJson(Map<String, dynamic> json) => OrderReview(
        stars: (json['stars'] as num).toInt(),
        comment: json['comment'] as String?,
      );
}

class Order {
  const Order({
    required this.id,
    this.shopId,
    this.review,
    required this.status,
    required this.paymentMethod,
    required this.totalAmount,
    required this.addressText,
    required this.customerPhone,
    this.comment,
    required this.createdAt,
    required this.items,
    required this.statusHistory,
    this.shopName,
    this.shopPhone,
  });

  final String id;
  final String? shopId;
  final OrderReview? review;
  final OrderStatus status;
  final PaymentMethod paymentMethod;
  final int totalAmount;

  /// Short display id, safe even if [id] is shorter than 8 characters (real
  /// ids are UUIDs, so this never happens in production).
  String get shortId => id.length <= 8 ? id : id.substring(0, 8);
  final String addressText;
  final String customerPhone;
  final String? comment;
  final DateTime createdAt;
  final List<OrderItem> items;
  final List<OrderStatusEvent> statusHistory;
  final String? shopName;
  final String? shopPhone;

  factory Order.fromJson(Map<String, dynamic> json) {
    final addressSnapshot = json['address_snapshot'] as Map<String, dynamic>?;
    final shop = json['shop'] as Map<String, dynamic>?;
    return Order(
      id: json['id'] as String,
      shopId: json['shop_id'] as String? ?? (shop?['id'] as String?),
      review: json['review'] is Map<String, dynamic> ? OrderReview.fromJson(json['review'] as Map<String, dynamic>) : null,
      status: OrderStatus.fromValue(json['status'] as String),
      paymentMethod: PaymentMethod.fromValue(json['payment_method'] as String),
      totalAmount: (json['total_amount'] as num).toInt(),
      addressText: addressSnapshot?['text'] as String? ?? '',
      customerPhone: json['customer_phone'] as String? ?? '',
      comment: json['comment'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      items: (json['items'] as List<dynamic>? ?? []).map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList(),
      statusHistory: (json['status_history'] as List<dynamic>? ?? [])
          .map((e) => OrderStatusEvent.fromJson(e as Map<String, dynamic>))
          .toList(),
      shopName: shop?['name'] as String?,
      shopPhone: shop?['phone'] as String?,
    );
  }
}
