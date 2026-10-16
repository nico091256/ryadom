import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../core/utils/launch_url.dart';
import '../../../ui/ui.dart';
import '../domain/order.dart';
import 'order_tracking_controller.dart';
import 'orders_providers.dart';
import 'widgets/order_card.dart' show orderShortRef;
import 'widgets/order_skeletons.dart';
import 'widgets/order_status_ui.dart';
import 'widgets/order_timeline.dart';

const double _kMaxContentWidth = 560;

class OrderTrackingScreen extends ConsumerStatefulWidget {
  const OrderTrackingScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends ConsumerState<OrderTrackingScreen> {
  Timer? _pollTimer;
  bool _cancelling = false;

  /// Set once when the order flips to delivered while this screen is open —
  /// drives the one-time success moment in the hero.
  bool _celebrate = false;

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

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/home');
    }
  }

  Future<void> _cancel() async {
    final confirmed = await showAppConfirm(
      context,
      title: ref.t('order.cancelOrder'),
      message: ref.t('order.cancelQuestion'),
      confirmLabel: ref.t('order.cancelOrder'),
      cancelLabel: ref.t('common.cancel'),
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    setState(() => _cancelling = true);
    try {
      await ref.read(ordersApiProvider).cancelOrder(widget.orderId);
      if (!mounted) return;
      ref.invalidate(orderProvider(widget.orderId));
    } on AppException catch (e) {
      if (!mounted) return;
      showAppToast(context, e.message, tone: ToastTone.error);
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<Order>>(orderProvider(widget.orderId), (previous, next) {
      final was = previous?.value?.status;
      final now = next.value?.status;
      if (!_celebrate && now == OrderStatus.delivered && was != null && was != OrderStatus.delivered) {
        setState(() => _celebrate = true);
      }
    });
    final orderAsync = ref.watch(orderProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(
        leadingWidth: 60,
        leading: Center(
          child: Padding(
            padding: const EdgeInsets.only(left: AppSpacing.md),
            child: AppIconButton(icon: LucideIcons.arrowLeft, onPressed: _back, tooltip: ref.t('common.back')),
          ),
        ),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(ref.t('order.title'), style: AppText.h3),
            Text(orderShortRef(widget.orderId), style: AppText.caption),
          ],
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
          child: orderAsync.when(
            skipLoadingOnRefresh: true,
            data: (order) => _OrderBody(
              order: order,
              celebrate: _celebrate,
              cancelling: _cancelling,
              onCancel: _cancel,
            ),
            loading: () => const OrderTrackingSkeleton(),
            error: (err, _) => EmptyState(
              illustration: AppIllustration.offline,
              title: ref.t('common.error'),
              subtitle: '$err',
              actionLabel: ref.t('common.retry'),
              onAction: () => ref.invalidate(orderProvider(widget.orderId)),
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderBody extends ConsumerWidget {
  const _OrderBody({required this.order, required this.celebrate, required this.cancelling, required this.onCancel});

  final Order order;
  final bool celebrate;
  final bool cancelling;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = order.status;
    final terminal = isTerminalOrderStatus(status);
    final phone = order.shopPhone;
    final comment = order.comment?.trim();

    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.lg, AppSpacing.page, AppSpacing.xxxl),
      physics: const BouncingScrollPhysics(),
      children: [
        _StatusHero(order: order, celebrate: celebrate),
        const SizedBox(height: AppSpacing.xl),
        AppSection(
          title: ref.t('order.stagesTitle'),
          child: OrderTimeline(order: order),
        ),
        const SizedBox(height: AppSpacing.xl),
        AppSection(
          title: ref.t('checkout.summaryDelivery'),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.xs),
          child: Column(
            children: [
              _InfoRow(icon: LucideIcons.mapPin, label: ref.t('checkout.deliveryAddress'), value: order.addressText),
              const Divider(),
              _InfoRow(
                icon: order.paymentMethod == PaymentMethod.cash ? LucideIcons.banknote : LucideIcons.creditCard,
                label: ref.t('checkout.paymentMethod'),
                value: ref.t(order.paymentMethod == PaymentMethod.cash ? 'checkout.cashOnDelivery' : 'order.paymentOnline'),
              ),
              if (comment != null && comment.isNotEmpty) ...[
                const Divider(),
                _InfoRow(icon: LucideIcons.messageSquare, label: ref.t('checkout.commentTitle'), value: comment),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        AppSection(title: ref.t('order.itemsTitle'), child: _ItemsList(order: order)),
        const SizedBox(height: AppSpacing.xxl),
        if (phone != null && phone.isNotEmpty) ...[
          AppButton(
            label: ref.t('order.callShop'),
            icon: LucideIcons.phone,
            variant: AppButtonVariant.outline,
            onPressed: () => launchCallerUrl(phone),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (status == OrderStatus.newOrder)
          AppButton(
            label: ref.t('order.cancelOrder'),
            icon: LucideIcons.xCircle,
            variant: AppButtonVariant.danger,
            loading: cancelling,
            onPressed: onCancel,
          ),
        if (terminal)
          AppButton(
            label: ref.t('order.backToHome'),
            icon: LucideIcons.home,
            onPressed: () => context.go('/home'),
          ),
      ],
    );
  }
}

/// Big status card. Cross-fades between statuses; when the order is
/// delivered while the screen is open the success illustration scales in.
class _StatusHero extends ConsumerWidget {
  const _StatusHero({required this.order, required this.celebrate});

  final Order order;
  final bool celebrate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = order.status;
    final active = isActiveOrderStatus(status);
    final cancelled = status == OrderStatus.cancelled;
    final delivered = status == OrderStatus.delivered;

    Widget? leading;
    if (delivered) {
      leading = const Illustration(AppIllustration.success, size: 72);
      if (celebrate) {
        leading = leading
            .animate()
            .scale(begin: const Offset(0.4, 0.4), end: const Offset(1, 1), duration: AppDurations.slow, curve: AppCurves.spring)
            .fadeIn(duration: AppDurations.normal);
      }
    } else if (cancelled) {
      leading = Container(
        width: 56,
        height: 56,
        decoration: const BoxDecoration(color: AppColors.dangerSoft, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: const Icon(LucideIcons.x, size: 26, color: AppColors.danger),
      );
    }

    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          ref.t('orderStatus.${status.value}'),
          style: cancelled ? AppText.h2.danger : AppText.h2,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(ref.t('order.hint.${status.value}'), style: AppText.bodySm),
      ],
    );

    return AppCard(
      elevated: true,
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: AnimatedSwitcher(
        duration: AppDurations.slow,
        switchInCurve: AppCurves.standard,
        switchOutCurve: Curves.easeIn,
        layoutBuilder: (current, previous) => Stack(
          alignment: Alignment.topLeft,
          children: [...previous, ?current],
        ),
        child: Column(
          key: ValueKey(status),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (leading != null) ...[leading, const SizedBox(width: AppSpacing.lg)],
                Expanded(child: text),
                if (active) ...[
                  const SizedBox(width: AppSpacing.sm),
                  const LiveTrackingBadge(),
                ],
              ],
            ),
            if (active) ...[
              const SizedBox(height: AppSpacing.lg),
              OrderProgressStrip(status, height: 6),
            ],
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: AppColors.ink50, borderRadius: BorderRadius.circular(AppRadius.sm)),
            alignment: Alignment.center,
            child: Icon(icon, size: 18, color: AppColors.ink700),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppText.caption),
                const SizedBox(height: AppSpacing.xxs),
                Text(value.isEmpty ? '—' : value, style: AppText.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemsList extends ConsumerWidget {
  const _ItemsList({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsSum = order.items.fold<int>(0, (acc, i) => acc + i.subtotal);
    // The model carries no explicit discount; a total below the item sum is
    // the promo/discount that was applied at checkout.
    final discount = itemsSum - order.totalAmount;

    return Column(
      children: [
        for (var i = 0; i < order.items.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.md),
          _ItemRow(item: order.items[i]),
        ],
        const SizedBox(height: AppSpacing.lg),
        const Divider(),
        if (discount > 0) ...[
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(child: Text(ref.t('order.discount'), style: AppText.bodyMedium.withColor(AppColors.orange600))),
              PriceText(discount, style: AppText.priceSm, color: AppColors.orange600, prefix: '−'),
            ],
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(child: Text(ref.t('order.totalPaid'), style: AppText.bodyStrong)),
            PriceText(order.totalAmount, style: AppText.priceLg),
          ],
        ),
      ],
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item});

  final OrderItem item;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text.rich(
            TextSpan(
              text: item.productName,
              children: [TextSpan(text: '  × ${item.quantity}', style: AppText.caption)],
            ),
            style: AppText.body,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        PriceText(item.subtotal, style: AppText.priceSm),
      ],
    );
  }
}
