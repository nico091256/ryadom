import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../location/presentation/address_controller.dart';
import '../domain/product.dart';
import '../domain/shop.dart';
import 'home_controller.dart';

/// Shop details with the distance from the selected delivery address.
final shopDetailProvider = FutureProvider.autoDispose.family<Shop, String>((ref, shopId) {
  final address = ref.watch(addressControllerProvider);
  return ref.read(shopsApiProvider).findOne(shopId, lat: address.lat, lng: address.lng);
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
