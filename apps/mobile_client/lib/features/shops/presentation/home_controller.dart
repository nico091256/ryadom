import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../location/presentation/address_controller.dart';
import '../data/shops_api.dart';
import '../domain/product.dart';
import '../domain/shop.dart';

final shopsApiProvider = Provider<ShopsApi>((ref) => ShopsApi(ref.read(apiClientProvider)));

/// Catalogue categories shown as the Home category strip. Cached for the
/// session — the list changes only when an admin edits it.
final homeCategoriesProvider = FutureProvider<List<ProductCategory>>((ref) => ref.read(shopsApiProvider).categories());

/// Selected Home category id (null = all shops). Drives the nearby query so
/// only shops that actually stock the category are listed.
final selectedHomeCategoryProvider = StateProvider<String?>((ref) => null);

/// Re-fetches automatically whenever the selected address or category changes.
final nearbyShopsProvider = FutureProvider.autoDispose<List<Shop>>((ref) async {
  final address = ref.watch(addressControllerProvider);
  final categoryId = ref.watch(selectedHomeCategoryProvider);
  return ref.read(shopsApiProvider).nearby(lat: address.lat, lng: address.lng, categoryId: categoryId);
});

final shopSearchQueryProvider = StateProvider.autoDispose<String>((ref) => '');

final filteredShopsProvider = Provider.autoDispose<AsyncValue<List<Shop>>>((ref) {
  final query = ref.watch(shopSearchQueryProvider).trim().toLowerCase();
  final shops = ref.watch(nearbyShopsProvider);
  if (query.isEmpty) return shops;
  return shops.whenData((list) => list.where((s) => s.name.toLowerCase().contains(query)).toList());
});

/// Whether Home may show the first-launch location prompt. Tests override
/// this to false so the sheet never opens under the widget tester.
final locationPromptEnabledProvider = Provider<bool>((ref) => true);
