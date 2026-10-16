import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';
import 'package:vibration/vibration.dart';
import '../../../app/theme.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../core/utils/launch_url.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/store_order.dart';
import 'orders_providers.dart';

const _acceptanceWindow = Duration(minutes: 10);
const _inProgressStatuses = {OrderStatus.accepted, OrderStatus.onTheWay};
const _completedStatuses = {OrderStatus.delivered, OrderStatus.cancelled};

class OrdersBoardScreen extends ConsumerStatefulWidget {
  const OrdersBoardScreen({super.key});

  @override
  ConsumerState<OrdersBoardScreen> createState() => _OrdersBoardScreenState();
}

class _OrdersBoardScreenState extends ConsumerState<OrdersBoardScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  Timer? _pollTimer;
  Timer? _tickTimer;
  Set<String> _knownOrderIds = {};
  String? _bannerText;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => ref.invalidate(ordersListProvider));
    // Re-renders the countdown badges every second without re-fetching.
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  void _onOrdersLoaded(List<StoreOrder> orders) {
    final currentIds = orders.map((o) => o.id).toSet();
    if (_knownOrderIds.isEmpty) {
      _knownOrderIds = currentIds;
      return;
    }
    final newIds = currentIds.difference(_knownOrderIds);
    final newOrders = orders.where((o) => newIds.contains(o.id) && o.status == OrderStatus.newOrder);
    if (newOrders.isNotEmpty) {
      final order = newOrders.first;
      Vibration.hasVibrator().then((has) {
        if (has) Vibration.vibrate(pattern: [0, 500, 200, 500]);
      });
      setState(() => _bannerText = ref.t('orders.newOrderAlert', {'id': order.shortId}));
    }
    _knownOrderIds = currentIds;
  }

  Future<void> _accept(StoreOrder order) async {
    try {
      await ref.read(ordersApiProvider).accept(order.id);
      ref.invalidate(ordersListProvider);
    } on AppException catch (e) {
      _showError(e.message);
    }
  }

  Future<void> _reject(StoreOrder order) async {
    final reason = await _promptReason();
    if (reason == null || reason.isEmpty) return;
    try {
      await ref.read(ordersApiProvider).reject(order.id, reason);
      ref.invalidate(ordersListProvider);
    } on AppException catch (e) {
      _showError(e.message);
    }
  }

  Future<String?> _promptReason() {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(ref.t('orders.rejectReasonTitle')),
        content: TextField(controller: controller, decoration: InputDecoration(hintText: ref.t('orders.rejectReasonPlaceholder'))),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(ref.t('common.cancel'))),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text.trim()),
            child: Text(ref.t('orders.reject')),
          ),
        ],
      ),
    );
  }

  Future<void> _advance(StoreOrder order, OrderStatus next) async {
    if (next == OrderStatus.delivered && order.paymentMethod == PaymentMethod.cash) {
      final lang = ref.read(localeProvider);
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(ref.t('orders.cashConfirmTitle')),
          content: Text(ref.t('orders.cashConfirmMessage', {'amount': formatPrice(order.totalAmount, lang)})),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: Text(ref.t('common.cancel'))),
            FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: Text(ref.t('orders.cashConfirmButton'))),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    try {
      await ref.read(ordersApiProvider).updateStatus(order.id, next.value);
      ref.invalidate(ordersListProvider);
    } on AppException catch (e) {
      _showError(e.message);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(ordersListProvider);
    ordersAsync.whenData(_onOrdersLoaded);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('orders.title')),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.seed,
          tabs: [
            Tab(text: ref.t('orders.newTab')),
            Tab(text: ref.t('orders.inProgressTab')),
            Tab(text: ref.t('orders.completedTab')),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: () => ref.read(authControllerProvider.notifier).logout()),
        ],
      ),
      body: Column(
        children: [
          if (_bannerText != null)
            Material(
              color: Colors.red,
              child: InkWell(
                onTap: () => setState(() => _bannerText = null),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  child: Row(
                    children: [
                      const Icon(Icons.notifications_active, color: Colors.white, size: 20),
                      const SizedBox(width: 10),
                      Expanded(child: Text(_bannerText!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
                      const Icon(Icons.close, color: Colors.white, size: 18),
                    ],
                  ),
                ),
              ),
            ),
          Expanded(
            child: ordersAsync.when(
              data: (orders) {
                final newOrders = orders.where((o) => o.status == OrderStatus.newOrder).toList();
                final inProgress = orders.where((o) => _inProgressStatuses.contains(o.status)).toList();
                final completed = orders.where((o) => _completedStatuses.contains(o.status)).toList();
                return TabBarView(
                  controller: _tabController,
                  children: [
                    _OrderListView(orders: newOrders, emptyText: ref.t('orders.empty'), onAccept: _accept, onReject: _reject, onAdvance: _advance),
                    _OrderListView(orders: inProgress, emptyText: ref.t('orders.empty'), onAccept: _accept, onReject: _reject, onAdvance: _advance),
                    _OrderListView(orders: completed, emptyText: ref.t('orders.empty'), onAccept: _accept, onReject: _reject, onAdvance: _advance),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(child: Text('$err')),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderListView extends StatelessWidget {
  const _OrderListView({required this.orders, required this.emptyText, required this.onAccept, required this.onReject, required this.onAdvance});

  final List<StoreOrder> orders;
  final String emptyText;
  final void Function(StoreOrder) onAccept;
  final void Function(StoreOrder) onReject;
  final void Function(StoreOrder, OrderStatus) onAdvance;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return Center(child: Text(emptyText, style: const TextStyle(color: Color(0xFF94A3B8))));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: orders.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, i) => _OrderCard(order: orders[i], onAccept: onAccept, onReject: onReject, onAdvance: onAdvance),
    );
  }
}

class _OrderCard extends ConsumerWidget {
  const _OrderCard({required this.order, required this.onAccept, required this.onReject, required this.onAdvance});

  final StoreOrder order;
  final void Function(StoreOrder) onAccept;
  final void Function(StoreOrder) onReject;
  final void Function(StoreOrder, OrderStatus) onAdvance;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(localeProvider);
    final isNew = order.status == OrderStatus.newOrder;
    final remaining = _acceptanceWindow - order.age;
    final isUrgent = isNew && remaining.inSeconds < 120;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isUrgent ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('#${order.shortId}', style: const TextStyle(fontWeight: FontWeight.w900)),
              if (isNew)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: isUrgent ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                  child: Text(
                    ref.t('orders.acceptanceWindow', {'count': '${remaining.isNegative ? 0 : remaining.inMinutes}'}),
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: isUrgent ? const Color(0xFFB91C1C) : const Color(0xFFB45309)),
                  ),
                )
              else
                Text(ref.t('orderStatusLabel.${order.status.value}'), style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: Text(order.customerName ?? order.customerPhone, style: const TextStyle(fontWeight: FontWeight.w700))),
              TextButton.icon(
                onPressed: () => launchCallerUrl(order.customerPhone),
                icon: const Icon(Icons.call, size: 16),
                label: Text(order.customerPhone, style: const TextStyle(fontSize: 12)),
              ),
            ],
          ),
          InkWell(
            onTap: order.addressLat != null ? () => launchMapsUrl(order.addressLat!, order.addressLng!) : null,
            child: Row(
              children: [
                const Icon(Icons.location_on, size: 14, color: Color(0xFF64748B)),
                const SizedBox(width: 4),
                Expanded(child: Text(order.addressText, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))),
              ],
            ),
          ),
          if (order.comment != null && order.comment!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(ref.t('orders.comment', {'text': order.comment!}), style: const TextStyle(fontSize: 12, color: Color(0xFFD97706), fontStyle: FontStyle.italic)),
            ),
          const Divider(height: 20),
          for (final item in order.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(child: Text('${item.productName} ×${item.quantity}', style: const TextStyle(fontSize: 13))),
                  Text(formatPrice(item.subtotal, lang), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(ref.t('orders.total'), style: const TextStyle(fontWeight: FontWeight.w800)),
              Text(
                '${formatPrice(order.totalAmount, lang)} (${order.paymentMethod == PaymentMethod.cash ? ref.t('orders.payCash') : ref.t('orders.payOnline')})',
                style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.seed),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _ActionRow(order: order, onAccept: onAccept, onReject: onReject, onAdvance: onAdvance),
        ],
      ),
    );
  }
}

class _ActionRow extends ConsumerWidget {
  const _ActionRow({required this.order, required this.onAccept, required this.onReject, required this.onAdvance});

  final StoreOrder order;
  final void Function(StoreOrder) onAccept;
  final void Function(StoreOrder) onReject;
  final void Function(StoreOrder, OrderStatus) onAdvance;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    switch (order.status) {
      case OrderStatus.newOrder:
        return Row(
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                onPressed: () => onReject(order),
                child: Text(ref.t('orders.reject')),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(child: ElevatedButton(onPressed: () => onAccept(order), child: Text(ref.t('orders.accept')))),
          ],
        );
      case OrderStatus.accepted:
        return SizedBox(
          width: double.infinity,
          child: ElevatedButton(onPressed: () => onAdvance(order, OrderStatus.onTheWay), child: Text(ref.t('orders.markOnTheWay'))),
        );
      case OrderStatus.onTheWay:
        return SizedBox(
          width: double.infinity,
          child: ElevatedButton(onPressed: () => onAdvance(order, OrderStatus.delivered), child: Text(ref.t('orders.markDelivered'))),
        );
      case OrderStatus.delivered:
      case OrderStatus.cancelled:
        return const SizedBox.shrink();
    }
  }
}
