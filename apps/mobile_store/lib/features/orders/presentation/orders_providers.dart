import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../data/orders_api.dart';
import '../domain/store_order.dart';

final ordersApiProvider = Provider<OrdersApi>((ref) => OrdersApi(ref.read(apiClientProvider)));

final ordersListProvider = FutureProvider.autoDispose<List<StoreOrder>>((ref) {
  return ref.read(ordersApiProvider).list();
});
