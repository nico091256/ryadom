import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../cart/presentation/cart_controller.dart';
import '../../domain/product.dart';

/// Opens a rich bottom sheet showing the product's large photo, category,
/// description, stock status, price and an interactive cart stepper / CTA.
Future<void> showProductDetailSheet(
  BuildContext context,
  WidgetRef ref, {
  required Product product,
  required String shopName,
  required bool shopIsOpen,
}) {
  return showAppSheet<void>(
    context,
    maxHeightFraction: 0.88,
    builder: (_) => _ProductDetailContent(
      product: product,
      shopName: shopName,
      shopIsOpen: shopIsOpen,
    ),
  );
}

class _ProductDetailContent extends ConsumerWidget {
  const _ProductDetailContent({
    required this.product,
    required this.shopName,
    required this.shopIsOpen,
  });

  final Product product;
  final String shopName;
  final bool shopIsOpen;

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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(localeProvider);
    final qty = ref.watch(cartControllerProvider.select((c) => c.quantityOf(product.id)));
    final soldOut = !product.isAvailable || product.stock <= 0;
    final lowStock = !soldOut && product.stock <= 5;
    final canAdd = !soldOut && shopIsOpen;
    final description = product.localizedDescription(lang);
    final catName = product.category?.localizedName(lang);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 230,
            decoration: BoxDecoration(
              color: AppColors.ink50,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.border, width: 0.8),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppImage(
                  url: product.imageUrl,
                  height: 230,
                  radius: BorderRadius.zero,
                  fit: BoxFit.cover,
                  fallbackIcon: LucideIcons.shoppingBag,
                ),
                Positioned(
                  top: AppSpacing.md,
                  left: AppSpacing.md,
                  child: Wrap(
                    spacing: 6,
                    children: [
                      if (catName != null && catName.isNotEmpty)
                        AppBadge(label: catName, tone: BadgeTone.brand, icon: LucideIcons.tag),
                      if (soldOut)
                        AppBadge(label: ref.t('shop.outOfStock'), tone: BadgeTone.neutral)
                      else if (lowStock)
                        AppBadge(label: ref.t('shop.lowStock'), tone: BadgeTone.warning),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            product.localizedName(lang),
            style: AppText.h2,
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              PriceText(product.price, style: AppText.priceLg),
              const Spacer(),
              if (!soldOut)
                Text(
                  '${product.stock} ta',
                  style: AppText.caption.copyWith(color: AppColors.textTertiary),
                ),
            ],
          ),
          if (description != null && description.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Text(
                description,
                style: AppText.body.secondary,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          if (soldOut)
            AppButton(
              label: ref.t('shop.outOfStock'),
              onPressed: null,
            )
          else if (qty == 0)
            AppButton(
              label: ref.t('tabs.cart'),
              icon: LucideIcons.plus,
              onPressed: canAdd ? () => _add(context, ref) : null,
            )
          else
            Row(
              children: [
                QuantityStepper(
                  quantity: qty,
                  size: 48,
                  max: product.stock,
                  enabled: canAdd,
                  onIncrement: () => _add(context, ref),
                  onDecrement: () => ref.read(cartControllerProvider.notifier).decrement(product.id),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: AppButton(
                    label: ref.t('common.done'),
                    variant: AppButtonVariant.secondary,
                    size: AppButtonSize.md,
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

