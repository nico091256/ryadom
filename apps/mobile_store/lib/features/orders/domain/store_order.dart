import 'package:localshop_shared/localshop_shared.dart';

class StoreOrderItem {
  const StoreOrderItem({required this.productName, required this.unitPrice, required this.quantity});

  final String productName;
  final int unitPrice;
  final int quantity;

  int get subtotal => unitPrice * quantity;

  factory StoreOrderItem.fromJson(Map<String, dynamic> json) => StoreOrderItem(
        productName: json['product_name'] as String,
        unitPrice: (json['unit_price'] as num).toInt(),
        quantity: (json['quantity'] as num).toInt(),
      );
}

class StoreOrder {
  const StoreOrder({
    required this.id,
    required this.status,
    required this.paymentMethod,
    required this.totalAmount,
    required this.addressText,
    required this.addressLat,
    required this.addressLng,
    this.customerName,
    required this.customerPhone,
    this.comment,
    required this.createdAt,
    required this.items,
  });

  final String id;
  final OrderStatus status;
  final PaymentMethod paymentMethod;
  final int totalAmount;
  final String addressText;
  final double? addressLat;
  final double? addressLng;
  final String? customerName;
  final String customerPhone;
  final String? comment;
  final DateTime createdAt;
  final List<StoreOrderItem> items;

  Duration get age => DateTime.now().difference(createdAt);

  /// Short display id, safe even if [id] is shorter than 8 characters
  /// (real ids are UUIDs so this never happens in production, but test
  /// fixtures and any future id scheme change shouldn't crash the UI).
  String get shortId => id.length <= 8 ? id : id.substring(0, 8);

  factory StoreOrder.fromJson(Map<String, dynamic> json) {
    final addressSnapshot = json['address_snapshot'] as Map<String, dynamic>?;
    final customer = json['customer'] as Map<String, dynamic>?;
    return StoreOrder(
      id: json['id'] as String,
      status: OrderStatus.fromValue(json['status'] as String),
      paymentMethod: PaymentMethod.fromValue(json['payment_method'] as String),
      totalAmount: (json['total_amount'] as num).toInt(),
      addressText: addressSnapshot?['text'] as String? ?? '',
      addressLat: (addressSnapshot?['lat'] as num?)?.toDouble(),
      addressLng: (addressSnapshot?['lng'] as num?)?.toDouble(),
      customerName: customer?['name'] as String?,
      customerPhone: json['customer_phone'] as String? ?? '',
      comment: json['comment'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      items: (json['items'] as List<dynamic>? ?? []).map((e) => StoreOrderItem.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
