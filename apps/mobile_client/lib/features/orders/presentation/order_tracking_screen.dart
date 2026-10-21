import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../core/realtime/order_socket.dart';
import '../../../core/utils/launch_url.dart';
import '../../../ui/ui.dart';
import '../domain/order.dart';
import 'order_tracking_controller.dart';
import 'orders_providers.dart';
import 'widgets/order_card.dart' show orderShortRef;
import 'widgets/order_rating_sheet.dart';
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
  StreamSubscription<OrderStatusPush>? _socketSub;
  int _ticks = 0;
  bool _cancelling = false;

  /// Set once when the order flips to delivered while this screen is open —
  /// drives the one-time success moment in the hero.
  bool _celebrate = false;

  @override
  void initState() {
    super.initState();
    // Realtime first: the gateway pushes `order:status` to this order's room
    // the moment the shopkeeper advances it. Any push refetches the order so
    // the UI always renders the server's full state, never just the event.
    _socketSub = ref.read(orderSocketProvider).watchOrder(widget.orderId).listen((_) {
      if (mounted) ref.invalidate(orderProvider(widget.orderId));
    });
    // Polling stays as the belt-and-suspenders fallback (same pattern as the
    // RN app): every 5s without a socket, every 20s while one is connected.
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _ticks++;
      if (ref.read(orderSocketProvider).isConnected && _ticks % 4 != 0) return;
      ref.invalidate(orderProvider(widget.orderId));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _socketSub?.cancel();
    ref.read(orderSocketProvider).unwatchOrder(widget.orderId);
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

  bool _ratingOpen = false;

  /// Opens the rating sheet; the submit handler posts the review and refreshes
  /// the order so the summary row replaces the button.
  Future<void> _rate() async {
    if (_ratingOpen) return;
    _ratingOpen = true;
    try {
      await showOrderRatingSheet(
        context,
        onSubmit: (stars, comment) async {
          await ref.read(ordersApiProvider).reviewOrder(widget.orderId, stars: stars, comment: comment);
          ref.invalidate(orderProvider(widget.orderId));
        },
      );
    } finally {
      _ratingOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<Order>>(orderProvider(widget.orderId), (previous, next) {
      final was = previous?.value?.status;
      final now = next.value?.status;
      if (!_celebrate && now == OrderStatus.delivered && was != null && was != OrderStatus.delivered) {
        setState(() => _celebrate = true);
        // Delivered while watching: offer the rating right away (PDF p.13).
        if (next.value?.review == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _rate();
          });
        }
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
      body: Stack(
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
              child: orderAsync.when(
                skipLoadingOnRefresh: true,
                data: (order) => _OrderBody(
                  order: order,
                  celebrate: _celebrate,
                  cancelling: _cancelling,
                  onCancel: _cancel,
                  onRate: _rate,
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
          if (_celebrate) const Positioned.fill(child: ConfettiOverlay()),
        ],
      ),
    );
  }
}

class _OrderBody extends ConsumerWidget {
  const _OrderBody({
    required this.order,
    required this.celebrate,
    required this.cancelling,
    required this.onCancel,
    required this.onRate,
  });

  final Order order;
  final bool celebrate;
  final bool cancelling;
  final VoidCallback onCancel;
  final VoidCallback onRate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = order.status;
    final terminal = isTerminalOrderStatus(status);
    final phone = order.shopPhone;
    final comment = order.comment?.trim();
    final courierVisible = status == OrderStatus.accepted || status == OrderStatus.onTheWay;

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
        const SizedBox(height: AppSpacing.xl),
        // The shopkeeper delivers personally, so the "courier" is the shop.
        if (courierVisible) ...[
          _CourierCard(shopName: order.shopName, phone: phone),
          const SizedBox(height: AppSpacing.xl),
        ],
        if (status == OrderStatus.delivered) ...[
          if (order.review != null)
            OrderRatingSummary(stars: order.review!.stars, comment: order.review!.comment)
          else
            AppButton(
              label: ref.t('order.rateService'),
              icon: LucideIcons.star,
              onPressed: onRate,
            ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (phone != null && phone.isNotEmpty && !courierVisible) ...[
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

    final itemsSummary = order.items.map((i) => i.productName).take(3).join(', ');
    final shopName = order.shopName?.trim();
    final subtitle = [if (itemsSummary.isNotEmpty) itemsSummary, if (shopName != null && shopName.isNotEmpty) shopName].join(' · ');

    if (active) {
      // Deep-green hero while the order is live: status as the headline, the
      // plain-language hint under it, live badge, and the 4-step strip. No
      // minute countdown — we don't have a real ETA for an order yet, and a
      // made-up one would be a promise we can't keep.
      return Container(
        decoration: BoxDecoration(color: AppColors.brand, borderRadius: AppRadius.card, boxShadow: AppShadows.brand),
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: AnimatedSwitcher(
          duration: AppDurations.slow,
          switchInCurve: AppCurves.standard,
          switchOutCurve: Curves.easeIn,
          layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, ?current]),
          child: Column(
            key: ValueKey(status),
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      ref.t('orderStatus.${status.value}'),
                      style: AppText.sarlavhaL.copyWith(color: AppColors.white),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const LiveTrackingBadge(),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                ref.t('order.hint.${status.value}'),
                style: AppText.body.copyWith(color: AppColors.white.withValues(alpha: 0.88)),
              ),
              if (subtitle.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  subtitle,
                  style: AppText.caption.copyWith(color: AppColors.white.withValues(alpha: 0.72)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              OrderProgressStrip(status, height: 6),
            ],
          ),
        ),
      );
    }

    return AppCard(
      elevated: true,
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        key: ValueKey(status),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (leading != null) ...[leading, const SizedBox(width: AppSpacing.lg)],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ref.t('orderStatus.${status.value}'),
                      style: cancelled ? AppText.h2.danger : AppText.h2,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(ref.t('order.hint.${status.value}'), style: AppText.bodySm),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Who is bringing the order + one-tap call. Ryadom shopkeepers deliver
/// themselves, so the contact is the shop's phone.
class _CourierCard extends ConsumerWidget {
  const _CourierCard({required this.shopName, required this.phone});

  final String? shopName;
  final String? phone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canCall = phone != null && phone!.isNotEmpty;
    final title = shopName == null || shopName!.isEmpty
        ? ref.t('order.courierFallback')
        : ref.t('order.courier', {'shop': shopName!});
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(color: AppColors.accentLight, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: const Icon(LucideIcons.bike, size: 24, color: AppColors.accent),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: AppText.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: AppSpacing.xxs),
                Text(ref.t('order.yourCourier'), style: AppText.caption),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          AppIconButton(
            icon: LucideIcons.phone,
            size: 44,
            background: canCall ? AppColors.accent : AppColors.ink100,
            foreground: AppColors.white,
            bordered: false,
            onPressed: canCall ? () => launchCallerUrl(phone!) : null,
            tooltip: ref.t('order.callShop'),
          ),
        ],
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
    final icon = _fallbackIcon(item.productName);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // 44x44 neutral thumbnail with contextual icon
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 20, color: AppColors.textPrimary.withValues(alpha: 0.6)),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                item.productName,
                style: AppText.bodyStrong.copyWith(fontSize: 14),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  Text(
                    '${item.quantity} dona · ',
                    style: AppText.caption,
                  ),
                  PriceText(item.unitPrice, style: AppText.micro.copyWith(color: AppColors.textSecondary)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        PriceText(item.subtotal, style: AppText.priceSm.copyWith(fontWeight: FontWeight.w700)),
      ],
    );
  }

  IconData _fallbackIcon(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('non')) return LucideIcons.croissant;
    if (lower.contains('sut')) return LucideIcons.milk;
    if (lower.contains('tuxum')) return LucideIcons.egg;
    if (lower.contains('choy') || lower.contains('kofe')) return LucideIcons.coffee;
    if (lower.contains('pishloq')) return LucideIcons.cookie;
    if (lower.contains('meva') || lower.contains('olma')) return LucideIcons.apple;
    return LucideIcons.package;
  }
}

