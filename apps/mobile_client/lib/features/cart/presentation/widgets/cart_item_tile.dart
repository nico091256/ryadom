import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../ui/ui.dart';
import '../../domain/cart_state.dart';
import '../cart_controller.dart';

/// One cart line: 64px image, name, unit price × qty, a stepper and the live
/// line subtotal. Swipe left to remove — removal goes through the controller
/// so SharedPreferences persistence stays in sync.
class CartItemTile extends ConsumerWidget {
  const CartItemTile({super.key, required this.item});

  final CartItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = item.product;
    final controller = ref.read(cartControllerProvider.notifier);

    return Dismissible(
      key: ValueKey('cart-item-${product.id}'),
      direction: DismissDirection.endToStart,
      background: const _RemoveBackground(),
      onDismissed: (_) => controller.remove(product.id),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppImage(
              url: product.imageUrl,
              width: 64,
              height: 64,
              radius: BorderRadius.circular(AppRadius.md),
              fallbackIcon: LucideIcons.shoppingBag,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.nameUz, style: AppText.bodyStrong, maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      Flexible(child: PriceText(product.price, style: AppText.priceSm.secondary)),
                      Text(' × ${item.quantity}', style: AppText.caption),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                QuantityStepper(
                  quantity: item.quantity,
                  size: 34,
                  max: product.stock,
                  onIncrement: () => controller.setQuantity(product.id, item.quantity + 1),
                  onDecrement: () => controller.decrement(product.id),
                ),
                const SizedBox(height: AppSpacing.sm),
                AnimatedPriceText(item.subtotal, style: AppText.priceSm),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RemoveBackground extends StatelessWidget {
  const _RemoveBackground();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.danger,
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: AppSpacing.xxl),
      child: const Icon(LucideIcons.trash2, size: 22, color: AppColors.white),
    );
  }
}
