import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../ui/ui.dart';
import '../../../cart/presentation/cart_controller.dart';
import '../../domain/product.dart';

/// Single product row exactly matching PDF Page 2:
/// Left: pastel rounded square illustration / image.
/// Middle: Product Name (title) + "1 dona · [narx]" (caption).
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

  static const List<Color> _pastelColors = [
    Color(0xFFF6D8A8), // Non / nonushta - warm beige
    Color(0xFFCCE4F7), // Sut - soft blue
    Color(0xFFFFF0B8), // Tuxum - soft yellow
    Color(0xFFFAD4CE), // Pishloq - soft pink/peach
    Color(0xFFD6E8D0), // Choy / meva - soft sage green
    Color(0xFFE2D4F0), // Others - soft lavender
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartControllerProvider);
    final inCart = cart.shopId == shopId ? cart.quantityOf(product.id) : 0;
    final color = _pastelColors[index % _pastelColors.length];

    const unitLabel = '1 dona';

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm + 2),
      child: Row(
        children: [
          // Pastel thumbnail matching PDF Page 2
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            alignment: Alignment.center,
            child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: Image.network(
                      product.imageUrl!,
                      width: 56,
                      height: 56,
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
                  style: AppText.asosiyMatn.copyWith(fontSize: 16),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  '$unitLabel · ${formatPrice(product.price)}',
                  style: AppText.izoh.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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

    return Icon(icon, size: 26, color: AppColors.textPrimary.withValues(alpha: 0.6));
  }
}
