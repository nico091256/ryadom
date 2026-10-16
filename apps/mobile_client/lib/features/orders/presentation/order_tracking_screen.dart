import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../core/utils/launch_url.dart';
import 'order_tracking_controller.dart';
import 'orders_providers.dart';

const _stages = [OrderStatus.newOrder, OrderStatus.accepted, OrderStatus.onTheWay, OrderStatus.delivered];

class OrderTrackingScreen extends ConsumerStatefulWidget {
  const OrderTrackingScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends ConsumerState<OrderTrackingScreen> {
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    // Polling fallback (same belt-and-suspenders approach as the RN app,
    // which also paired a socket subscription with 5s polling). Socket.IO
    // realtime is a fast-follow enhancement on top of this.
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      ref.invalidate(orderProvider(widget.orderId));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(ref.t('order.cancelQuestion')),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(ref.t('common.cancel'))),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: Text(ref.t('order.cancelOrder'))),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(ordersApiProvider).cancelOrder(widget.orderId);
      ref.invalidate(orderProvider(widget.orderId));
    } on AppException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final orderAsync = ref.watch(orderProvider(widget.orderId));
    final lang = ref.watch(localeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('${ref.t('order.title')} #${widget.orderId.substring(0, 8)}'),
        leading: IconButton(icon: const Icon(Icons.home), onPressed: () => context.go('/home')),
      ),
      body: orderAsync.when(
        data: (order) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (order.status == OrderStatus.cancelled)
              _CancelledBanner(reason: order.statusHistory.isNotEmpty ? order.statusHistory.last.reason : null)
            else
              _StagesTimeline(currentStatus: order.status),
            const SizedBox(height: 16),
            _Card(
              title: ref.t('order.itemsTitle'),
              child: Column(
                children: [
                  for (final item in order.items)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(child: Text('${item.productName} ×${item.quantity}')),
                          Text(formatPrice(item.subtotal, lang)),
                        ],
                      ),
                    ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(ref.t('order.totalPaid'), style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(formatPrice(order.totalAmount, lang), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _Card(
              title: ref.t('checkout.deliveryAddress'),
              child: Text(order.addressText),
            ),
            const SizedBox(height: 16),
            if (order.shopPhone != null)
              OutlinedButton.icon(
                onPressed: () => launchCallerUrl(order.shopPhone!),
                icon: const Icon(Icons.call),
                label: Text(ref.t('order.callShop')),
              ),
            if (order.status == OrderStatus.newOrder) ...[
              const SizedBox(height: 10),
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                onPressed: _cancel,
                child: Text(ref.t('order.cancelOrder')),
              ),
            ],
          ],
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('$err')),
      ),
    );
  }
}

class _StagesTimeline extends ConsumerWidget {
  const _StagesTimeline({required this.currentStatus});
  final OrderStatus currentStatus;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentIndex = _stages.indexOf(currentStatus);
    return _Card(
      title: ref.t('order.stagesTitle'),
      child: Column(
        children: [
          for (var i = 0; i < _stages.length; i++)
            Row(
              children: [
                Icon(
                  i <= currentIndex ? Icons.check_circle : Icons.circle_outlined,
                  color: i <= currentIndex ? AppTheme.seed : const Color(0xFFCBD5E1),
                  size: 20,
                ),
                const SizedBox(width: 10),
                Text(
                  ref.t('orderStatus.${_stages[i].value}'),
                  style: TextStyle(
                    fontWeight: i == currentIndex ? FontWeight.w800 : FontWeight.w500,
                    color: i <= currentIndex ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _CancelledBanner extends ConsumerWidget {
  const _CancelledBanner({this.reason});
  final String? reason;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          const Icon(Icons.cancel, color: Color(0xFFEF4444)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              reason ?? ref.t('orderStatus.cancelled'),
              style: const TextStyle(color: Color(0xFF991B1B), fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}
