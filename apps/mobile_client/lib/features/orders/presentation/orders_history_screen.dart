import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import '../domain/order.dart';
import 'orders_history_controller.dart';
import 'reorder.dart';
import 'widgets/order_card.dart';
import 'widgets/order_segmented_control.dart';
import 'widgets/order_skeletons.dart';
import 'widgets/order_status_ui.dart';

const double _kMaxContentWidth = 560;

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
    final orders = ordersAsync.value;
    final active = orders?.where((o) => isActiveOrderStatus(o.status)).toList();
    final history = orders?.where((o) => !isActiveOrderStatus(o.status)).toList();

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.xl, AppSpacing.page, AppSpacing.lg),
                  child: Text(ref.t('orders.title'), style: AppText.h1),
                ),
                Padding(
                  padding: AppSpacing.pagePadding,
                  child: OrderSegmentedControl(
                    controller: _tabController,
                    segments: [
                      OrderSegment(label: ref.t('orders.activeTab'), count: active?.length),
                      OrderSegment(label: ref.t('orders.historyTab'), count: history?.length),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Expanded(
                  child: ordersAsync.when(
                    skipLoadingOnRefresh: true,
                    data: (_) => TabBarView(
                      controller: _tabController,
                      children: [
                        _OrderList(orders: active!, isHistory: false),
                        _OrderList(orders: history!, isHistory: true),
                      ],
                    ),
                    loading: () => const OrderListSkeleton(),
                    error: (err, _) => EmptyState(
                      illustration: AppIllustration.offline,
                      title: ref.t('common.error'),
                      subtitle: '$err',
                      actionLabel: ref.t('common.retry'),
                      onAction: () => ref.invalidate(myOrdersProvider),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderList extends ConsumerStatefulWidget {
  const _OrderList({required this.orders, required this.isHistory});

  final List<Order> orders;
  final bool isHistory;

  @override
  ConsumerState<_OrderList> createState() => _OrderListState();
}

class _OrderListState extends ConsumerState<_OrderList> {
  /// Entrance stagger plays once, on first appearance; items rebuilt while
  /// scrolling later must not re-animate.
  bool _entranceDone = false;
  Timer? _entranceTimer;
  String? _reorderingId;

  static const _staggerCount = 8;
  static const _staggerStep = Duration(milliseconds: 45);

  @override
  void initState() {
    super.initState();
    _entranceTimer = Timer(_staggerStep * _staggerCount + AppDurations.slow, () {
      if (mounted) setState(() => _entranceDone = true);
    });
  }

  @override
  void dispose() {
    _entranceTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleReorder(Order order) async {
    if (_reorderingId != null) return;
    setState(() => _reorderingId = order.id);
    try {
      await reorderOrder(context, ref, order);
    } finally {
      if (mounted) setState(() => _reorderingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = widget.orders;
    if (orders.isEmpty) {
      return EmptyState(
        illustration: AppIllustration.noOrders,
        title: ref.t(widget.isHistory ? 'orders.emptyHistory' : 'orders.emptyActive'),
        actionLabel: ref.t('cart.startShopping'),
        onAction: () => context.go('/home'),
      );
    }

    return RefreshIndicator(
      color: AppColors.brand,
      backgroundColor: AppColors.surface,
      onRefresh: () async {
        ref.invalidate(myOrdersProvider);
        try {
          await ref.read(myOrdersProvider.future);
        } catch (_) {
          // The provider surfaces the error state itself; nothing to do here.
        }
      },
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.sm, AppSpacing.page, AppSpacing.xxxl),
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        itemCount: orders.length,
        itemBuilder: (context, i) {
          final order = orders[i];
          Widget card = OrderCard(
            key: ValueKey(order.id),
            order: order,
            onTap: () => context.push('/order/${order.id}'),
            onReorder: widget.isHistory ? () => _handleReorder(order) : null,
            reorderBusy: _reorderingId == order.id,
          );
          if (!_entranceDone && i < _staggerCount) {
            card = card
                .animate(delay: _staggerStep * i)
                .fadeIn(duration: AppDurations.slow, curve: AppCurves.standard)
                .moveY(begin: 14, end: 0, duration: AppDurations.slow, curve: AppCurves.emphasized);
          }
          return Padding(padding: const EdgeInsets.only(bottom: AppSpacing.md), child: card);
        },
      ),
    );
  }
}
