import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/product.dart';
import '../domain/shop.dart';
import 'home_controller.dart';

final shopDetailProvider = FutureProvider.autoDispose.family<Shop, String>((ref, shopId) {
  return ref.read(shopsApiProvider).findOne(shopId);
});

final shopProductsProvider = FutureProvider.autoDispose.family<List<Product>, String>((ref, shopId) {
  return ref.read(shopsApiProvider).products(shopId);
});

final productSearchQueryProvider = StateProvider.autoDispose<String>((ref) => '');
final selectedCategoryIdProvider = StateProvider.autoDispose<String?>((ref) => null);

final filteredProductsProvider = Provider.autoDispose.family<AsyncValue<List<Product>>, String>((ref, shopId) {
  final query = ref.watch(productSearchQueryProvider).trim().toLowerCase();
  final categoryId = ref.watch(selectedCategoryIdProvider);
  final products = ref.watch(shopProductsProvider(shopId));

  return products.whenData((list) => list.where((p) {
        final matchesQuery = query.isEmpty || p.nameUz.toLowerCase().contains(query);
        final matchesCategory = categoryId == null || p.categoryId == categoryId;
        return matchesQuery && matchesCategory;
      }).toList());
});
