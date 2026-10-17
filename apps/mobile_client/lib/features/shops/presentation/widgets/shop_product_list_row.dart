import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../cart/presentation/cart_controller.dart';
import '../../domain/product.dart';

/// One product as a list row (phone widths): 64px square photo on a neutral
/// tile, name + price, capsule stepper on the right. Same rules as the grid
/// tile — stock cap, closed-shop lock, sold-out state, different-shop confirm.
class ShopProductListRow extends ConsumerWidget {
  const ShopProductListRow({
    super.key,
    required this.product,
    required this.shopName,
    required this.shopIsOpen,
  });

  final Product product;
  final String shopName;
  final bool shopIsOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final qty = ref.watch(cartControllerProvider.select((c) => c.quantityOf(product.id)));
    final soldOut = !product.isAvailable || product.stock <= 0;
    final lowStock = !soldOut && product.stock <= 5;
    final canAdd = !soldOut && shopIsOpen;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Opacity(
            opacity: soldOut ? 0.5 : 1,
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(AppRadius.md)),
              clipBehavior: Clip.antiAlias,
              child: AppImage(
                url: product.imageUrl,
                width: 64,
                height: 64,
                radius: BorderRadius.circular(AppRadius.md),
                fallbackIcon: LucideIcons.shoppingBag,
                fallbackColor: AppColors.background,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  product.nameUz,
                  style: soldOut ? AppText.title.tertiary : AppText.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    PriceText(product.price, style: AppText.priceSm, color: soldOut ? AppColors.textTertiary : null),
                    if (soldOut) ...[
                      const SizedBox(width: AppSpacing.sm),
                      AppBadge(label: ref.t('shop.outOfStock'), tone: BadgeTone.neutral, size: 11),
                    ] else if (lowStock) ...[
                      const SizedBox(width: AppSpacing.sm),
                      AppBadge(label: ref.t('shop.lowStock'), tone: BadgeTone.warning, size: 11),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          if (!soldOut)
            QuantityStepper(
              quantity: qty,
              size: 40,
              max: product.stock,
              enabled: canAdd,
              onIncrement: () => _add(context, ref),
              onDecrement: () => ref.read(cartControllerProvider.notifier).decrement(product.id),
            ),
        ],
      ),
    );
  }

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final result = ref.read(cartControllerProvider.notifier).addOrIncrement(product, shopName);
    if (result != AddToCartResult.differentShop) return;

    final ok = await showAppConfirm(
      context,
      title: ref.t('cart.differentShopTitle'),
      message: ref.t('cart.multipleShopsWarning'),
      confirmLabel: ref.t('cart.clearCart'),
      cancelLabel: ref.t('common.cancel'),
      destructive: true,
    );
    if (!ok || !context.mounted) return;
    ref.read(cartControllerProvider.notifier).clearAndAdd(product, shopName);
  }
}
