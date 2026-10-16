import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../orders/presentation/orders_history_controller.dart';
import '../../../orders/presentation/reorder.dart';
import '../../../orders/presentation/widgets/order_status_ui.dart';

/// "Oxirgi buyurtma" card on Home (design PDF p.4): what was ordered, where
/// and when, with one-tap reorder. Renders nothing until the first order.
class RecentOrderCard extends ConsumerWidget {
  const RecentOrderCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(myOrdersProvider).valueOrNull;
    if (orders == null || orders.isEmpty) return const SizedBox.shrink();

    final latest = orders.first;
    final names = latest.items.map((e) => e.productName).toList();
    final summary = names.take(3).join(', ') + (names.length > 3 ? ' +${names.length - 3}' : '');
    final canReorder = latest.shopId != null && latest.items.any((i) => i.productId != null);

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.xl, AppSpacing.page, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(ref.t('home.recentOrder'), style: AppText.h3),
          const SizedBox(height: AppSpacing.md),
          AppCard(
            onTap: () => context.push('/order/${latest.id}'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        summary.isEmpty ? ref.t('order.title') : summary,
                        style: AppText.bodyStrong,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    OrderStatusBadge(latest.status),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  [if (latest.shopName != null && latest.shopName!.isNotEmpty) latest.shopName!, formatRelativeDay(ref, latest.createdAt)].join(' · '),
                  style: AppText.caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    PriceText(latest.totalAmount, style: AppText.price),
                    const Spacer(),
                    AppButton(
                      label: ref.t('orders.reorder'),
                      icon: LucideIcons.rotateCcw,
                      variant: AppButtonVariant.secondary,
                      size: AppButtonSize.sm,
                      expand: false,
                      onPressed: canReorder ? () => reorderOrder(context, ref, latest) : null,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// "Bugun, 14:05" / "Kecha, 09:30" / "3 okt, 18:20" in the current locale.
String formatRelativeDay(WidgetRef ref, DateTime at) {
  final local = at.toLocal();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(local.year, local.month, local.day);
  final time = DateFormat('HH:mm').format(local);
  if (day == today) return '${ref.t('time.today')}, $time';
  if (day == today.subtract(const Duration(days: 1))) return '${ref.t('time.yesterday')}, $time';
  return DateFormat('d MMM, HH:mm').format(local);
}
