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
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.brand,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    boxShadow: AppShadows.brand,
                  ),
                  child: Row(
                    children: [
                      _CountPill(count: count),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Text(ref.t('cart.goToCart'), style: AppText.button.onBrand, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      AnimatedPriceText(total, style: AppText.price.onBrand),
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

class _CountPill extends StatelessWidget {
  const _CountPill({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 30),
      height: 30,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      decoration: BoxDecoration(color: AppColors.white.withValues(alpha: 0.22), borderRadius: AppRadius.chip),
      alignment: Alignment.center,
      child: AnimatedSwitcher(
        duration: AppDurations.fast,
        transitionBuilder: (child, anim) => FadeTransition(
          opacity: anim,
          child: ScaleTransition(scale: Tween(begin: 0.7, end: 1.0).animate(anim), child: child),
        ),
        child: Text('$count', key: ValueKey(count), style: AppText.numeric.onBrand.weight(700)),
      ),
    );
  }
}
