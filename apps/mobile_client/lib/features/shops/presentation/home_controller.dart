import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../location/presentation/address_controller.dart';
import '../data/shops_api.dart';
import '../domain/shop.dart';

final shopsApiProvider = Provider<ShopsApi>((ref) => ShopsApi(ref.read(apiClientProvider)));

/// Re-fetches automatically whenever the selected address changes.
final nearbyShopsProvider = FutureProvider.autoDispose<List<Shop>>((ref) async {
  final address = ref.watch(addressControllerProvider);
  return ref.read(shopsApiProvider).nearby(lat: address.lat, lng: address.lng);
});

final shopSearchQueryProvider = StateProvider.autoDispose<String>((ref) => '');

final filteredShopsProvider = Provider.autoDispose<AsyncValue<List<Shop>>>((ref) {
  final query = ref.watch(shopSearchQueryProvider).trim().toLowerCase();
  final shops = ref.watch(nearbyShopsProvider);
  if (query.isEmpty) return shops;
  return shops.whenData((list) => list.where((s) => s.name.toLowerCase().contains(query)).toList());
});
