import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/order.dart';
import 'orders_providers.dart';

final myOrdersProvider = FutureProvider.autoDispose<List<Order>>((ref) {
  return ref.read(ordersApiProvider).myOrders();
});
