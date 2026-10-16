import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/order.dart';
import 'orders_providers.dart';

final orderProvider = FutureProvider.autoDispose.family<Order, String>((ref, orderId) {
  return ref.read(ordersApiProvider).getOrder(orderId);
});
