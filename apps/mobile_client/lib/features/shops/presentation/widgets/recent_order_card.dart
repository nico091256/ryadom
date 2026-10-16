import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../cart/domain/cart_state.dart';
import '../../../cart/presentation/cart_controller.dart';
import '../../../orders/domain/order.dart';
import '../../../orders/presentation/orders_history_controller.dart';
import '../../domain/product.dart';

/// "Oxirgi buyurtma" card matching PDF Page 4:
/// Displays products list, shop name + date, and a "Qayta buyurtma" CTA.
class RecentOrderCard extends ConsumerWidget {
  const RecentOrderCard({super.key});

  Future<void> _handleReorder(BuildContext context, WidgetRef ref, Order order) async {
    final cart = ref.read(cartControllerProvider);
    final targetShopId = order.shopId ?? 'shp_${order.shopName.hashCode}';
    final targetShopName = order.shopName ?? 'Do\'kon';

    if (cart.shopId != null && cart.shopId != targetShopId && !cart.isEmpty) {
      final confirmed = await showAppConfirm(
        context,
        title: ref.t('cart.title'),
        message: ref.t('cart.multipleShopsWarning'),
        confirmLabel: ref.t('common.confirm'),
        cancelLabel: ref.t('common.cancel'),
      );
      if (!confirmed) return;
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

    if (!context.mounted) return;
    showAppToast(context, ref.t('orders.reorderSuccess'), tone: ToastTone.success);
    context.push('/cart');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(myOrdersProvider);
    final orders = ordersAsync.valueOrNull;
    if (orders == null || orders.isEmpty) {
      return const SizedBox.shrink();
    }

    final latest = orders.first;
    final itemsSummary = latest.items.map((e) => e.productName).take(3).join(', ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.page),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Oxirgi buyurtma',
            style: AppText.sarlavhaM.copyWith(fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        itemsSummary.isNotEmpty ? itemsSummary : 'Buyurtma',
                        style: AppText.bodyStrong.copyWith(fontSize: 16),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${latest.shopName ?? 'Do\'kon'} · kecha',
                        style: AppText.izoh,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                AppButton(
                  label: 'Qayta buyurtma',
                  variant: AppButtonVariant.outline,
                  size: AppButtonSize.sm,
                  expand: false,
                  onPressed: () => _handleReorder(context, ref, latest),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
