import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../ui/ui.dart';
import '../../../cart/presentation/cart_controller.dart';
import '../../domain/product.dart';

/// Single product row per user spec:
/// Left: Large square photo (64x64) with clean consistent neutral background (#F3F6F4), centered product.
/// Middle: Product Name (title, 16px Manrope 700) + "1 dona · PriceText".
/// Right: QuantityStepper ([+] or [- 1 +]).
class ShopProductListRow extends ConsumerWidget {
  const ShopProductListRow({
    super.key,
    required this.product,
    required this.shopId,
    required this.shopName,
    required this.index,
  });

  final Product product;
  final String shopId;
  final String shopName;
  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartControllerProvider);
    final inCart = cart.shopId == shopId ? cart.quantityOf(product.id) : 0;

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
      elevated: true,
      child: Row(
        children: [
          // Large clean square thumbnail (64x64), neutral background, centered product
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            alignment: Alignment.center,
            child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: Image.network(
                      product.imageUrl!,
                      width: 64,
                      height: 64,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => _fallbackIcon(product.nameUz),
                    ),
                  )
                : _fallbackIcon(product.nameUz),
          ),
          const SizedBox(width: AppSpacing.md),
          // Product Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  product.nameUz,
                  style: AppText.title.copyWith(fontSize: 16, fontWeight: FontWeight.w700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '1 dona · ',
                      style: AppText.izoh.copyWith(color: AppColors.textSecondary),
                    ),
                    PriceText(
                      product.price,
                      style: AppText.priceSm.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Stepper: [+] or [- 1 +]
          QuantityStepper(
            quantity: inCart,
            onIncrement: () {
              ref.read(cartControllerProvider.notifier).addOrIncrement(product, shopName);
            },
            onDecrement: () {
              ref.read(cartControllerProvider.notifier).decrement(product.id);
            },
          ),
        ],
      ),
    );
  }

  Widget _fallbackIcon(String name) {
    final lower = name.toLowerCase();
    IconData icon = LucideIcons.package;
    if (lower.contains('non')) {
      icon = LucideIcons.croissant;
    } else if (lower.contains('sut')) {
      icon = LucideIcons.milk;
    } else if (lower.contains('tuxum')) {
      icon = LucideIcons.egg;
    } else if (lower.contains('choy') || lower.contains('kofe')) {
      icon = LucideIcons.coffee;
    } else if (lower.contains('pishloq')) {
      icon = LucideIcons.cookie;
    } else if (lower.contains('meva') || lower.contains('banan') || lower.contains('olma')) {
      icon = LucideIcons.apple;
    }

    return Icon(icon, size: 28, color: AppColors.textPrimary.withValues(alpha: 0.5));
  }
}
