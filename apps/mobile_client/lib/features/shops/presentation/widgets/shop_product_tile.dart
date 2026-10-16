import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../cart/presentation/cart_controller.dart';
import '../../domain/product.dart';

const double _kTilePadding = 10;
const double _kImageRadius = AppRadius.md;

/// Extra vertical room a tile needs below its square image (paddings, price,
/// two-line name). Scales with the user's text size so the grid never clips.
double shopProductTileExtent(double tileWidth, TextScaler scaler) {
  final text = scaler.scale(AppText.price.fontSize! * AppText.price.height! + 2 * AppText.bodySmStrong.fontSize! * AppText.bodySmStrong.height!);
  final image = tileWidth - 2 * _kTilePadding - 2; // minus hairline border
  return image + _kTilePadding * 2 + 2 + AppSpacing.sm + AppSpacing.xs + text + 2;
}

/// One product in the grid: square photo with the round "+" (or stepper) on
/// it, price, two-line name. Stock badges sit on the photo.
class ShopProductTile extends ConsumerWidget {
  const ShopProductTile({super.key, required this.product, required this.shopName, required this.shopIsOpen});

  final Product product;
  final String shopName;
  final bool shopIsOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final qty = ref.watch(cartControllerProvider.select((c) => c.quantityOf(product.id)));
    final soldOut = !product.isAvailable || product.stock <= 0;
    final lowStock = !soldOut && product.stock <= 5;
    final canAdd = product.isAvailable && product.stock > 0 && shopIsOpen;

    return AppCard(
      padding: const EdgeInsets.all(_kTilePadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final side = constraints.maxWidth;
              Widget image = AppImage(
                url: product.imageUrl,
                width: side,
                height: side,
                radius: BorderRadius.circular(_kImageRadius),
                fallbackIcon: LucideIcons.shoppingBag,
              );
              if (soldOut) {
                image = Opacity(
                  opacity: 0.5,
                  child: ColorFiltered(colorFilter: const ColorFilter.matrix(_grayscale), child: image),
                );
              }
              return SizedBox(
                width: side,
                height: side,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    image,
                    if (soldOut)
                      Positioned(top: 6, left: 6, child: AppBadge(label: ref.t('shop.outOfStock'), tone: BadgeTone.neutral))
                    else if (lowStock)
                      Positioned(top: 6, left: 6, child: AppBadge(label: ref.t('shop.lowStock'), tone: BadgeTone.warning)),
                    if (!soldOut)
                      Positioned(
                        right: 6,
                        bottom: 6,
                        child: DecoratedBox(
                          decoration: BoxDecoration(borderRadius: BorderRadius.circular(17), boxShadow: AppShadows.sm),
                          child: QuantityStepper(
                            quantity: qty,
                            compact: true,
                            size: 34,
                            max: product.stock,
                            enabled: canAdd,
                            onIncrement: () => _add(context, ref),
                            onDecrement: () => ref.read(cartControllerProvider.notifier).decrement(product.id),
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          PriceText(product.price, style: AppText.price, color: soldOut ? AppColors.textTertiary : null),
          const SizedBox(height: AppSpacing.xs),
          Text(
            product.nameUz,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: soldOut ? AppText.bodySmStrong.tertiary : AppText.bodySmStrong,
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

// Luminance-preserving desaturation for sold-out photos.
const List<double> _grayscale = [
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0, 0, 0, 1, 0, //
];

/// Shimmer stand-in for [ShopProductTile] while products load. Bare blocks
/// (no white card) so a single enclosing [Skeleton] tints only the shapes.
class ShopProductTileSkeleton extends StatelessWidget {
  const ShopProductTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(_kTilePadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          AspectRatio(aspectRatio: 1, child: SizedBox.expand(child: SkeletonBox(radius: _kImageRadius))),
          SizedBox(height: AppSpacing.sm),
          SkeletonLine(width: 72, height: 16),
          SizedBox(height: AppSpacing.sm),
          SkeletonLine(height: 12),
          SizedBox(height: AppSpacing.xs),
          SkeletonLine(width: 96, height: 12),
        ],
      ),
    );
  }
}
