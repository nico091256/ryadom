import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import '../../shops/presentation/shop_detail_controller.dart';
import '../../shops/presentation/widgets/shop_card.dart';
import 'favorites_controller.dart';

const double _kMaxContentWidth = 560;

/// "Sevimlilarim": the customer's saved shops, each loaded fresh from the
/// API so hours, open state and distance are current.
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ids = ref.watch(favoriteShopsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          tooltip: ref.t('common.back'),
          onPressed: context.popOrGoHome,
        ),
        title: Text(ref.t('favorites.title')),
      ),
      body: ids.isEmpty
          ? EmptyState(
              illustration: AppIllustration.noShops,
              title: ref.t('favorites.emptyTitle'),
              subtitle: ref.t('favorites.emptySubtitle'),
              actionLabel: ref.t('favorites.browse'),
              onAction: () {
                ref.read(mainTabProvider.notifier).state = 0;
                context.go('/home');
              },
            )
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.md, AppSpacing.page, AppSpacing.xxxl),
                  itemCount: ids.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
                  itemBuilder: (context, i) => _FavoriteShopTile(key: ValueKey(ids[i]), shopId: ids[i])
                      .animate(delay: (i.clamp(0, 6) * 40).ms)
                      .fadeIn(duration: AppDurations.slow)
                      .moveY(begin: 10, end: 0, curve: AppCurves.standard),
                ),
              ),
            ),
    );
  }
}

class _FavoriteShopTile extends ConsumerWidget {
  const _FavoriteShopTile({super.key, required this.shopId});

  final String shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(shopDetailProvider(shopId)).when(
          data: (shop) => ShopCard(shop: shop, onTap: () => context.push('/shop/${shop.id}')),
          loading: () => const ShopCardSkeleton(),
          // Deleted / deactivated shop, or offline: say so and offer removal.
          error: (_, _) => AppCard(
            child: Row(
              children: [
                const Icon(LucideIcons.store, color: AppColors.ink400),
                const SizedBox(width: AppSpacing.md),
                Expanded(child: Text(ref.t('favorites.unavailable'), style: AppText.bodyMedium.secondary)),
                TextButton(
                  onPressed: () => ref.invalidate(shopDetailProvider(shopId)),
                  child: Text(ref.t('common.retry')),
                ),
                IconButton(
                  tooltip: ref.t('favorites.remove'),
                  icon: const Icon(LucideIcons.trash2, size: 18, color: AppColors.danger),
                  onPressed: () => ref.read(favoriteShopsProvider.notifier).toggle(shopId),
                ),
              ],
            ),
          ),
        );
  }
}
