import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../data/orders_api.dart';

final ordersApiProvider = Provider<OrdersApi>((ref) => OrdersApi(ref.read(apiClientProvider)));
