import 'package:uuid/uuid.dart';
import '../../../core/network/api_client.dart';
import '../domain/order.dart';

class CreateOrderPayload {
  const CreateOrderPayload({
    required this.addressText,
    required this.lat,
    required this.lng,
    required this.customerPhone,
    required this.paymentMethod,
    this.comment,
    this.promoCode,
  });

  final String addressText;
  final double lat;
  final double lng;
  final String customerPhone;
  final String paymentMethod;
  final String? comment;
  final String? promoCode;

  Map<String, dynamic> toJson() => {
        'address_text': addressText,
        'lat': lat,
        'lng': lng,
        'customer_phone': customerPhone,
        'payment_method': paymentMethod,
        'comment': ?comment,
        'promo_code': ?promoCode,
      };
}

class OrdersApi {
  OrdersApi(this._client);
  final ApiClient _client;

  /// Idempotency-Key makes a retried submit (double-tap, timeout-retry)
  /// return the original order instead of creating a duplicate.
  Future<Order> createOrder(CreateOrderPayload payload) async {
    final data = await _client.post(
      '/orders',
      data: payload.toJson(),
      headers: {'Idempotency-Key': const Uuid().v4()},
    ) as Map<String, dynamic>;
    return Order.fromJson(data);
  }

  Future<Order> getOrder(String id) async {
    final data = await _client.get('/orders/$id') as Map<String, dynamic>;
    return Order.fromJson(data);
  }

  /// GET /orders filters by the caller's role server-side (customer sees
  /// only their own orders) and returns a { data, total, page, limit } envelope.
  Future<List<Order>> myOrders({String? status}) async {
    final data = await _client.get('/orders', query: {'status': ?status, 'limit': 100}) as Map<String, dynamic>;
    return (data['data'] as List<dynamic>).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> cancelOrder(String id, {String? reason}) =>
      _client.post('/orders/$id/cancel', data: {'reason': ?reason});

  /// POST /orders/:id/review — one 1..5 star rating per delivered order.
  Future<void> reviewOrder(String id, {required int stars, String? comment}) {
    final trimmed = comment?.trim();
    return _client.post('/orders/$id/review', data: {
      'stars': stars,
      if (trimmed != null && trimmed.isNotEmpty) 'comment': trimmed,
    });
  }
}
