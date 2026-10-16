import '../../../core/network/api_client.dart';
import '../domain/seller_product.dart';
import '../domain/seller_shop.dart';

class SellerStatsPeriod {
  const SellerStatsPeriod({required this.orderCount, required this.revenueTiyin});

  final int orderCount;
  final int revenueTiyin;

  factory SellerStatsPeriod.fromJson(Map<String, dynamic> json) =>
      SellerStatsPeriod(orderCount: json['orderCount'] as int, revenueTiyin: json['revenueTiyin'] as int);
}

class SellerStats {
  const SellerStats({required this.today, required this.thisWeek, required this.thisMonth});

  final SellerStatsPeriod today;
  final SellerStatsPeriod thisWeek;
  final SellerStatsPeriod thisMonth;

  factory SellerStats.fromJson(Map<String, dynamic> json) => SellerStats(
        today: SellerStatsPeriod.fromJson(json['today'] as Map<String, dynamic>),
        thisWeek: SellerStatsPeriod.fromJson(json['thisWeek'] as Map<String, dynamic>),
        thisMonth: SellerStatsPeriod.fromJson(json['thisMonth'] as Map<String, dynamic>),
      );
}

class ProductInput {
  const ProductInput({
    required this.nameUz,
    this.nameRu,
    this.nameEn,
    required this.categoryId,
    this.descriptionUz,
    this.descriptionRu,
    this.descriptionEn,
    required this.price,
    this.imageUrl,
    required this.stock,
    this.isAvailable,
  });

  final String nameUz;
  final String? nameRu;
  final String? nameEn;
  final String categoryId;
  final String? descriptionUz;
  final String? descriptionRu;
  final String? descriptionEn;
  final int price;
  final String? imageUrl;
  final int stock;
  final bool? isAvailable;

  Map<String, dynamic> toJson() => {
        'name_uz': nameUz,
        'name_ru': ?nameRu,
        'name_en': ?nameEn,
        'category_id': categoryId,
        'description_uz': ?descriptionUz,
        'description_ru': ?descriptionRu,
        'description_en': ?descriptionEn,
        'price': price,
        'image_url': ?imageUrl,
        'stock': stock,
        'is_available': ?isAvailable,
      };
}

class SellerApi {
  SellerApi(this._client);
  final ApiClient _client;

  Future<SellerShop> getShop() async => SellerShop.fromJson(await _client.get('/seller/shop') as Map<String, dynamic>);

  Future<SellerShop> updateShop(Map<String, dynamic> patch) async =>
      SellerShop.fromJson(await _client.put('/seller/shop', data: patch) as Map<String, dynamic>);

  Future<List<SellerProduct>> getProducts() async {
    final data = await _client.get('/seller/products') as List<dynamic>;
    return data.map((e) => SellerProduct.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<SellerProduct> createProduct(ProductInput input) async =>
      SellerProduct.fromJson(await _client.post('/seller/products', data: input.toJson()) as Map<String, dynamic>);

  Future<SellerProduct> updateProduct(String id, Map<String, dynamic> patch) async =>
      SellerProduct.fromJson(await _client.put('/seller/products/$id', data: patch) as Map<String, dynamic>);

  Future<void> deleteProduct(String id) => _client.delete('/seller/products/$id');

  Future<SellerStats> getStats() async => SellerStats.fromJson(await _client.get('/seller/stats') as Map<String, dynamic>);

  Future<String> uploadImage(String filePath) => _client.uploadImage(filePath);
}
