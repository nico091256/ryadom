import '../../../core/network/api_client.dart';
import '../domain/store_order.dart';

class OrdersApi {
  OrdersApi(this._client);
  final ApiClient _client;

  /// GET /orders is role-aware server-side: a seller sees only their shop's
  /// orders. Request a large page so no active order is ever dropped off
  /// the default page size.
  Future<List<StoreOrder>> list() async {
    final data = await _client.get('/orders', query: {'limit': 100}) as Map<String, dynamic>;
    return (data['data'] as List<dynamic>).map((e) => StoreOrder.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> accept(String orderId) => _client.post('/orders/$orderId/accept');

  Future<void> reject(String orderId, String reason) => _client.post('/orders/$orderId/reject', data: {'reason': reason});

  Future<void> cancel(String orderId, String reason) => _client.post('/orders/$orderId/cancel', data: {'reason': reason});

  /// status must be 'on_the_way' or 'delivered' — the only forward moves a
  /// seller can make per the 4-state machine.
  Future<void> updateStatus(String orderId, String status) => _client.patch('/orders/$orderId/status', data: {'status': status});
}
