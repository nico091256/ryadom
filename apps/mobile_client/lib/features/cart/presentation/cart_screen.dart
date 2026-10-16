import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'cart_controller.dart';
import 'widgets/cart_action_bar.dart';
import 'widgets/cart_item_tile.dart';
import 'widgets/cart_summary_card.dart';

const double _maxContentWidth = 560;

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  Future<void> _confirmClear(BuildContext context, WidgetRef ref) async {
    final ok = await showAppConfirm(
      context,
      title: ref.t('cart.clearCart'),
      message: ref.t('cart.clearConfirm'),
      confirmLabel: ref.t('cart.clearCart'),
      cancelLabel: ref.t('common.cancel'),
      destructive: true,
    );
    if (!ok || !context.mounted) return;
    ref.read(cartControllerProvider.notifier).clear();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isEmpty = ref.watch(cartControllerProvider.select((c) => c.isEmpty));
    final shopName = ref.watch(cartControllerProvider.select((c) => c.shopName));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(ref.t('cart.title')),
            if (!isEmpty && shopName != null && shopName.isNotEmpty)
              Text(shopName, style: AppText.caption, maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
        actions: [
          if (!isEmpty)
            TextButton(
              onPressed: () => _confirmClear(context, ref),
              style: TextButton.styleFrom(foregroundColor: AppColors.danger),
              child: Text(ref.t('cart.clearCart')),
            ),
          const SizedBox(width: AppSpacing.sm),
        ],
      ),
      body: isEmpty
          ? EmptyState(
              illustration: AppIllustration.emptyCart,
              title: ref.t('cart.empty'),
              subtitle: ref.t('cart.emptySubtitle'),
              actionLabel: ref.t('cart.startShopping'),
              onAction: () => context.go('/home'),
            )
          : const _CartBody(),
      bottomNavigationBar: isEmpty ? null : const _CartBottomBar(),
    );
  }
}

class _CartBody extends ConsumerWidget {
  const _CartBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(cartControllerProvider.select((c) => c.items));

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _maxContentWidth),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.lg, AppSpacing.page, AppSpacing.xxl),
          children: [
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (var i = 0; i < items.length; i++) ...[
                    CartItemTile(key: ValueKey(items[i].product.id), item: items[i]),
                    // Divider aligned with the text column (gutter + image + gap).
                    if (i < items.length - 1) const Divider(indent: AppSpacing.lg + 64 + AppSpacing.md),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            const CartSummaryCard(),
            const SizedBox(height: AppSpacing.md),
            const DeliveryInfoStrip(),
          ],
        ),
      ),
    );
  }
}

class _CartBottomBar extends ConsumerWidget {
  const _CartBottomBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final total = ref.watch(cartControllerProvider.select((c) => c.totalAmount));
    final isEmpty = ref.watch(cartControllerProvider.select((c) => c.isEmpty));

    return CartActionBar(
      label: ref.t('cart.checkout'),
      total: total,
      maxWidth: _maxContentWidth,
      onPressed: isEmpty ? null : () => context.push('/checkout'),
    );
  }
}
