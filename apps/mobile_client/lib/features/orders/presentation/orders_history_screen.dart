import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/providers.dart';
import '../../cart/domain/cart_state.dart';
import '../../cart/presentation/cart_controller.dart';
import '../../shops/domain/product.dart';
import '../domain/order.dart';
import 'orders_history_controller.dart';

const _activeStatuses = {OrderStatus.newOrder, OrderStatus.accepted, OrderStatus.onTheWay};

class OrdersHistoryScreen extends ConsumerStatefulWidget {
  const OrdersHistoryScreen({super.key});

  @override
  ConsumerState<OrdersHistoryScreen> createState() => _OrdersHistoryScreenState();
}

class _OrdersHistoryScreenState extends ConsumerState<OrdersHistoryScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(myOrdersProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('orders.title')),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.seed,
          tabs: [Tab(text: ref.t('orders.activeTab')), Tab(text: ref.t('orders.historyTab'))],
        ),
      ),
      body: ordersAsync.when(
        data: (orders) {
          final active = orders.where((o) => _activeStatuses.contains(o.status)).toList();
          final history = orders.where((o) => !_activeStatuses.contains(o.status)).toList();
          return TabBarView(
            controller: _tabController,
            children: [
              _OrderList(orders: active, emptyText: ref.t('orders.emptyActive'), isHistory: false),
              _OrderList(orders: history, emptyText: ref.t('orders.emptyHistory'), isHistory: true),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('$err')),
      ),
    );
  }
}

class _OrderList extends ConsumerWidget {
  const _OrderList({required this.orders, required this.emptyText, required this.isHistory});
  final List<Order> orders;
  final String emptyText;
  final bool isHistory;

  Future<void> _handleReorder(BuildContext context, WidgetRef ref, Order order) async {
    final cart = ref.read(cartControllerProvider);
    final targetShopId = order.shopId ?? 'shp_${order.shopName.hashCode}';
    final targetShopName = order.shopName ?? 'Do\'kon';

    if (cart.shopId != null && cart.shopId != targetShopId && !cart.isEmpty) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(ref.t('cart.title')),
          content: Text(ref.t('cart.multipleShopsWarning')),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(ref.t('common.cancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(ref.t('common.confirm')),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    final cartItems = order.items.map((item) {
      return CartItem(
        product: Product(
          id: item.productId ?? 'prd_${item.productName.hashCode}',
          shopId: targetShopId,
          categoryId: '',
          nameUz: item.productName,
          price: item.unitPrice,
          stock: 99,
          isAvailable: true,
        ),
        quantity: item.quantity,
      );
    }).toList();

    ref.read(cartControllerProvider.notifier).reorder(
      shopId: targetShopId,
      shopName: targetShopName,
      items: cartItems,
    );

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ref.t('orders.reorderSuccess')),
          action: SnackBarAction(
            label: ref.t('cart.goToCart'),
            onPressed: () => context.push('/cart'),
          ),
        ),
      );
      context.push('/cart');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (orders.isEmpty) {
      return Center(child: Text(emptyText, style: const TextStyle(color: Color(0xFF94A3B8))));
    }
    final lang = ref.watch(localeProvider);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(myOrdersProvider),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final order = orders[i];
          return InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => context.push('/order/${order.id}'),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(order.shopName ?? '#${order.shortId}', style: const TextStyle(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text(ref.t('orderStatus.${order.status.value}'), style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                          ],
                        ),
                      ),
                      Text(formatPrice(order.totalAmount, lang), style: const TextStyle(fontWeight: FontWeight.w800)),
                    ],
                  ),
                  if (isHistory && order.items.isNotEmpty) ...[
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${order.items.length} ta mahsulot',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                        ),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            side: const BorderSide(color: AppTheme.seed),
                            foregroundColor: AppTheme.seed,
                          ),
                          onPressed: () => _handleReorder(context, ref, order),
                          icon: const Icon(Icons.replay, size: 16),
                          label: Text(ref.t('orders.reorder'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
