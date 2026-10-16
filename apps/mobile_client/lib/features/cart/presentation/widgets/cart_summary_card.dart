import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../cart_controller.dart';

/// "Xarid hisobi" — items, free delivery and the animated grand total.
/// Shared by the cart and checkout screens; watches only the two cart
/// fields it renders so item edits elsewhere don't rebuild it needlessly.
class CartSummaryCard extends ConsumerWidget {
  const CartSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemCount = ref.watch(cartControllerProvider.select((c) => c.itemCount));
    final total = ref.watch(cartControllerProvider.select((c) => c.totalAmount));

    return AppSection(
      title: ref.t('checkout.summaryTitle'),
      child: Column(
        children: [
          _SummaryRow(
            label: ref.t('checkout.summaryItems', {'count': '$itemCount'}),
            value: PriceText(total, style: AppText.priceSm),
          ),
          const SizedBox(height: AppSpacing.md),
          _SummaryRow(
            label: ref.t('checkout.summaryDelivery'),
            value: Text(ref.t('checkout.free'), style: AppText.bodyStrong.brand),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Divider(),
          ),
          Row(
            children: [
              Expanded(child: Text(ref.t('cart.total'), style: AppText.title)),
              AnimatedPriceText(total, style: AppText.priceLg),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(label, style: AppText.body.secondary)),
        const SizedBox(width: AppSpacing.md),
        value,
      ],
    );
  }
}

/// Soft green strip: courier icon + "Yetkazish bepul · 10–30 daqiqa".
class DeliveryInfoStrip extends ConsumerWidget {
  const DeliveryInfoStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(color: AppColors.green50, borderRadius: BorderRadius.circular(AppRadius.md)),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(color: AppColors.green100, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: const Icon(LucideIcons.bike, size: 18, color: AppColors.green700),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(ref.t('cart.deliveryInfo'), style: AppText.bodySmStrong.withColor(AppColors.green700)),
          ),
        ],
      ),
    );
  }
}
