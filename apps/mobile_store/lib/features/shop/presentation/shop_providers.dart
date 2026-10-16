import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../data/categories_api.dart';
import '../data/seller_api.dart';
import '../domain/seller_product.dart';
import '../domain/seller_shop.dart';

final sellerApiProvider = Provider<SellerApi>((ref) => SellerApi(ref.read(apiClientProvider)));
final categoriesApiProvider = Provider<CategoriesApi>((ref) => CategoriesApi(ref.read(apiClientProvider)));

final sellerShopProvider = FutureProvider.autoDispose<SellerShop>((ref) => ref.read(sellerApiProvider).getShop());
final sellerProductsProvider = FutureProvider.autoDispose<List<SellerProduct>>((ref) => ref.read(sellerApiProvider).getProducts());
final categoriesProvider = FutureProvider.autoDispose<List<SellerCategory>>((ref) => ref.read(categoriesApiProvider).list());
final sellerStatsProvider = FutureProvider.autoDispose((ref) => ref.read(sellerApiProvider).getStats());
