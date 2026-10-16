import '../../../core/network/api_client.dart';
import '../domain/seller_product.dart';

class CategoriesApi {
  CategoriesApi(this._client);
  final ApiClient _client;

  Future<List<SellerCategory>> list() async {
    final data = await _client.get('/categories') as List<dynamic>;
    return data.map((e) => SellerCategory.fromJson(e as Map<String, dynamic>)).toList();
  }
}
