import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../domain/order.dart';
import 'order_status_ui.dart';

/// Formats an order timestamp as "12 Oct, 14:35" (locale-agnostic months).
String formatOrderDate(DateTime dt) => DateFormat('d MMM, HH:mm').format(dt.toLocal());

/// "#" + first 6 characters of the id — what the customer quotes on the phone.
String orderShortRef(String id) => '#${id.length <= 6 ? id : id.substring(0, 6)}'.toUpperCase();

/// Orders-list card: shop row + status, progress strip for live orders, date
/// and short id, item preview, total and a contextual action.
class OrderCard extends ConsumerWidget {
  const OrderCard({
    super.key,
    required this.order,
    required this.onTap,
    this.onReorder,
    this.reorderBusy = false,
  });

  final Order order;
  final VoidCallback onTap;

  /// When provided the card is in "history" mode and shows a reorder button;
  /// otherwise it shows a track button.
  final VoidCallback? onReorder;
  final bool reorderBusy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = isActiveOrderStatus(order.status);
    final shopName = order.shopName ?? ref.t('profile.defaultName');
    final names = order.items.map((i) => i.productName).toList();
    final preview = names.take(3).join(' · ');
    final more = names.length - 3;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppAvatar(name: order.shopName ?? '', size: 44),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(shopName, style: AppText.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(width: AppSpacing.sm),
              OrderStatusBadge(order.status),
            ],
          ),
          if (active) ...[
            const SizedBox(height: AppSpacing.md),
            OrderProgressStrip(order.status),
          ],
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              const Icon(LucideIcons.clock, size: 13, color: AppColors.textTertiary),
              const SizedBox(width: AppSpacing.xs),
              Text(formatOrderDate(order.createdAt), style: AppText.caption),
              const SizedBox(width: AppSpacing.sm),
              Text('·', style: AppText.caption.tertiary),
              const SizedBox(width: AppSpacing.sm),
              Text(orderShortRef(order.id), style: AppText.caption.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
          if (names.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text.rich(
              TextSpan(
                text: preview,
                children: [if (more > 0) TextSpan(text: '  +$more', style: AppText.bodySmStrong.secondary)],
              ),
              style: AppText.bodySm,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          const Divider(),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(child: PriceText(order.totalAmount, style: AppText.price)),
              if (onReorder != null)
                AppButton(
                  label: ref.t('orders.reorder'),
                  icon: LucideIcons.rotateCcw,
                  size: AppButtonSize.sm,
                  variant: AppButtonVariant.outline,
                  expand: false,
                  loading: reorderBusy,
                  onPressed: onReorder,
                )
              else
                AppButton(
                  label: ref.t('orders.track'),
                  size: AppButtonSize.sm,
                  variant: AppButtonVariant.secondary,
                  expand: false,
                  trailing: const Icon(LucideIcons.chevronRight, size: 14, color: AppColors.green700),
                  onPressed: onTap,
                ),
            ],
          ),
        ],
      ),
    );
  }
}
