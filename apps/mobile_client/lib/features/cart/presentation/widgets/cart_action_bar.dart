import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

/// Sticky white bottom bar with a hairline on top and one primary CTA that
/// carries the order total in a translucent pill. Used by cart and checkout.
class CartActionBar extends StatelessWidget {
  const CartActionBar({
    super.key,
    required this.label,
    required this.total,
    this.onPressed,
    this.loading = false,
    this.maxWidth = 560,
  });

  final String label;
  /// Amount in tiyin.
  final int total;
  final VoidCallback? onPressed;
  final bool loading;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          // heightFactor: 1 keeps the bar as tall as its button — a bare Center
          // would expand into the loose bottomNavigationBar slot and eat the body.
          child: Center(
            heightFactor: 1,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: AppButton(
                label: label,
                onPressed: onPressed,
                loading: loading,
                trailing: _TotalPill(total),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TotalPill extends StatelessWidget {
  const _TotalPill(this.total);

  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.18),
        borderRadius: AppRadius.chip,
      ),
      child: PriceText(total, style: AppText.button.onBrand),
    );
  }
}
