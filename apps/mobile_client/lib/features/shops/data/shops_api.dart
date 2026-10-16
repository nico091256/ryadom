import '../../../core/network/api_client.dart';
import '../domain/product.dart';
import '../domain/shop.dart';

class ShopsApi {
  ShopsApi(this._client);
  final ApiClient _client;

  /// The backend has no text-search param on this endpoint (only
  /// /shops/:id/products does) — filtering by name is done client-side in
  /// the controller below, over the already-fetched nearby list.
  Future<List<Shop>> nearby({required double lat, required double lng}) async {
    final data = await _client.get('/shops/nearby', query: {'lat': lat, 'lng': lng}) as List<dynamic>;
    return data.map((json) => Shop.fromJson(json as Map<String, dynamic>)).toList();
  }

  Future<Shop> findOne(String shopId) async {
    final data = await _client.get('/shops/$shopId') as Map<String, dynamic>;
    return Shop.fromJson(data);
  }

  Future<List<Product>> products(String shopId, {String? categoryId, String? query}) async {
    final data = await _client.get('/shops/$shopId/products', query: {
      'category': ?categoryId,
      if (query != null && query.isNotEmpty) 'q': query,
    }) as List<dynamic>;
    return data.map((json) => Product.fromJson(json as Map<String, dynamic>)).toList();
  }
}
