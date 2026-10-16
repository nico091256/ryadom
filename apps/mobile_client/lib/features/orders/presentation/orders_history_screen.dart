import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/providers.dart';
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
              _OrderList(orders: active, emptyText: ref.t('orders.emptyActive')),
              _OrderList(orders: history, emptyText: ref.t('orders.emptyHistory')),
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
  const _OrderList({required this.orders, required this.emptyText});
  final List<Order> orders;
  final String emptyText;

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
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Row(
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
            ),
          );
        },
      ),
    );
  }
}
