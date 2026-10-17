import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../cart/presentation/cart_controller.dart';

/// Height of the floating bar; the grid reserves this much extra bottom room.
const double kShopCartBarHeight = 56;

/// Green bar that slides up from the bottom while this shop's cart has items.
/// Watches only (shopId, itemCount, totalAmount) so product tiles never rebuild.
class ShopCartBar extends ConsumerWidget {
  const ShopCartBar({super.key, required this.shopId, this.maxWidth = 560});

  final String shopId;
  final double maxWidth;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (cartShopId, count, total) = ref.watch(cartControllerProvider.select((c) => (c.shopId, c.itemCount, c.totalAmount)));
    final visible = cartShopId == shopId && count > 0;
    const duration = Duration(milliseconds: 240);

    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedSlide(
        offset: visible ? Offset.zero : const Offset(0, 1.4),
        duration: duration,
        curve: AppCurves.emphasized,
        child: AnimatedOpacity(
          opacity: visible ? 1 : 0,
          duration: duration,
          curve: AppCurves.standard,
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: Pressable(
                onTap: () => context.push('/cart'),
                haptic: true,
                scale: 0.98,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                child: Container(
                  height: kShopCartBarHeight,
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: AppColors.brand,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    boxShadow: AppShadows.brand,
                  ),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.shoppingBag, size: 20, color: AppColors.white),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          '${ref.t('cart.title')} · ${ref.t('cart.itemsCount', {'count': '$count'})}',
                          style: AppText.button.onBrand,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      AnimatedPriceText(total, style: AppText.priceLg.onBrand),
                      const SizedBox(width: AppSpacing.xs),
                      const Icon(LucideIcons.arrowRight, size: 18, color: AppColors.white),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
