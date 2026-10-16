import '../../../core/network/api_client.dart';
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
}
