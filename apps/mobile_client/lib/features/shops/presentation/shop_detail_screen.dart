import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import '../../cart/presentation/cart_controller.dart';
import '../domain/shop.dart';
import 'shop_detail_controller.dart';
import 'widgets/shop_cart_bar.dart';
import 'widgets/shop_cover_app_bar.dart';
import 'widgets/shop_header_card.dart';
import 'widgets/shop_product_list_row.dart';
import 'widgets/shop_product_tile.dart';
import 'widgets/shop_toolbar.dart';

/// Header card, toolbar and grid share this width on tablets / desktop web.
const double _kMaxContentWidth = 840;

/// Floating cart bar is narrower so it reads as a button, not a footer.
const double _kMaxBarWidth = 560;

const double _kGridGap = AppSpacing.md;

class ShopDetailScreen extends ConsumerWidget {
  const ShopDetailScreen({super.key, required this.shopId});

  final String shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shopAsync = ref.watch(shopDetailProvider(shopId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: shopAsync.when(
        skipLoadingOnRefresh: false,
        data: (shop) => _ShopDetailBody(shop: shop),
        loading: () => const _ShopDetailSkeleton(),
        error: (_, _) => _ShopDetailError(shopId: shopId),
      ),
    );
  }
}

class _ShopDetailBody extends ConsumerWidget {
  const _ShopDetailBody({required this.shop});

  final Shop shop;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasCategories = ref.watch(
      shopProductsProvider(shop.id).select((value) => value.value?.any((p) => p.category != null) ?? false),
    );
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            ShopCoverAppBar(shop: shop, onBack: () => context.pop()),
            SliverToBoxAdapter(
              child: ShopOverlapShift(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(AppSpacing.page, 0, AppSpacing.page, AppSpacing.xs),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ShopHeaderCard(shop: shop),
                          if (!shop.isCurrentlyOpen) ...[
                            const SizedBox(height: AppSpacing.md),
                            const ShopClosedStrip(),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: ShopToolbarDelegate(shopId: shop.id, hasCategories: hasCategories, maxContentWidth: _kMaxContentWidth),
            ),
            _ShopProductGrid(shopId: shop.id, shopName: shop.name, shopIsOpen: shop.isCurrentlyOpen),
          ],
        ),
        Positioned(
          left: AppSpacing.page,
          right: AppSpacing.page,
          bottom: AppSpacing.page + bottomInset,
          child: ShopCartBar(shopId: shop.id, maxWidth: _kMaxBarWidth),
        ),
      ],
    );
  }
}

/// Page gutter that also centres the grid inside [_kMaxContentWidth] on wide screens.
double _sidePadding(double crossAxisExtent) {
  final centred = (crossAxisExtent - _kMaxContentWidth) / 2;
  return centred > AppSpacing.page ? centred : AppSpacing.page;
}

/// Builds the delegate used by both the live grid and its skeleton so tile
/// sizes match exactly: 2 columns on phones, ~200px tiles above 700px.
SliverGridDelegate _gridDelegate(double width, TextScaler scaler) {
  if (width > 700) {
    const maxExtent = 200.0;
    final columns = (width / (maxExtent + _kGridGap)).ceil();
    final tileWidth = (width - _kGridGap * (columns - 1)) / columns;
    return SliverGridDelegateWithMaxCrossAxisExtent(
      maxCrossAxisExtent: maxExtent,
      mainAxisSpacing: _kGridGap,
      crossAxisSpacing: _kGridGap,
      mainAxisExtent: shopProductTileExtent(tileWidth, scaler),
    );
  }
  final tileWidth = (width - _kGridGap) / 2;
  return SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,
    mainAxisSpacing: _kGridGap,
    crossAxisSpacing: _kGridGap,
    mainAxisExtent: shopProductTileExtent(tileWidth, scaler),
  );
}

class _ShopProductGrid extends ConsumerWidget {
  const _ShopProductGrid({required this.shopId, required this.shopName, required this.shopIsOpen});

  final String shopId;
  final String shopName;
  final bool shopIsOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(filteredProductsProvider(shopId));
    final barVisible = ref.watch(cartControllerProvider.select((c) => c.shopId == shopId && c.itemCount > 0));
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final bottomPad = AppSpacing.xxl + bottomInset + (barVisible ? kShopCartBarHeight + AppSpacing.lg : 0);
    final scaler = MediaQuery.textScalerOf(context);

    return productsAsync.when(
      skipLoadingOnRefresh: false,
      data: (products) {
        if (products.isEmpty) {
          return SliverFillRemaining(
            hasScrollBody: false,
            child: Padding(
              padding: EdgeInsets.only(bottom: bottomPad),
              child: EmptyState(title: ref.t('shop.noProducts'), illustration: AppIllustration.empty, compact: true),
            ),
          );
        }
        return SliverLayoutBuilder(
          builder: (context, constraints) {
            final side = _sidePadding(constraints.crossAxisExtent);
            final gridWidth = constraints.crossAxisExtent - 2 * side;

            if (constraints.crossAxisExtent <= 600) {
              return SliverPadding(
                padding: EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.sm, AppSpacing.page, bottomPad),
                sliver: SliverList.separated(
                  itemCount: products.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => ShopProductListRow(
                    key: ValueKey<String>(products[i].id),
                    product: products[i],
                    shopName: shopName,
                    shopIsOpen: shopIsOpen,
                  ),
                ),
              );
            }

            return SliverPadding(
              padding: EdgeInsets.fromLTRB(side, AppSpacing.md, side, bottomPad),
              sliver: SliverGrid(
                gridDelegate: _gridDelegate(gridWidth, scaler),
                delegate: SliverChildBuilderDelegate(
                  (context, i) => ShopProductTile(
                    key: ValueKey<String>(products[i].id),
                    product: products[i],
                    shopName: shopName,
                    shopIsOpen: shopIsOpen,
                  ),
                  childCount: products.length,
                  findChildIndexCallback: (key) {
                    final id = (key as ValueKey<String>).value;
                    final index = products.indexWhere((p) => p.id == id);
                    return index == -1 ? null : index;
                  },
                ),
              ),
            );
          },
        );
      },
      loading: () => SliverLayoutBuilder(
        builder: (context, constraints) {
          final side = _sidePadding(constraints.crossAxisExtent);
          return SliverPadding(
            padding: EdgeInsets.fromLTRB(side, AppSpacing.md, side, bottomPad),
            sliver: SliverToBoxAdapter(child: _ProductGridSkeleton(scaler: scaler)),
          );
        },
      ),
      error: (_, _) => SliverFillRemaining(
        hasScrollBody: false,
        child: EmptyState(
          title: ref.t('common.error'),
          illustration: AppIllustration.offline,
          compact: true,
          actionLabel: ref.t('common.retry'),
          onAction: () => ref.invalidate(shopProductsProvider(shopId)),
        ),
      ),
    );
  }
}

class _ProductGridSkeleton extends StatelessWidget {
  const _ProductGridSkeleton({required this.scaler});

  static const count = 6;

  final TextScaler scaler;

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: LayoutBuilder(
        builder: (context, constraints) => GridView.builder(
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: _gridDelegate(constraints.maxWidth, scaler),
          itemCount: count,
          itemBuilder: (_, _) => const ShopProductTileSkeleton(),
        ),
      ),
    );
  }
}

/// Full-screen placeholder while the shop itself loads: cover, header card,
/// toolbar and six tiles, all shimmering in sync. Back stays available.
class _ShopDetailSkeleton extends StatelessWidget {
  const _ShopDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final scaler = MediaQuery.textScalerOf(context);

    return Stack(
      children: [
        Skeleton(
          child: SingleChildScrollView(
            physics: const NeverScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SkeletonBox(height: top + kShopCoverHeight, radius: 0),
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.lg, AppSpacing.page, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              const SkeletonBox(height: 62, circle: true),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: const [
                                    SkeletonLine(width: 180, height: 20),
                                    SizedBox(height: AppSpacing.sm),
                                    SkeletonLine(width: 120, height: 12),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.md),
                          const Row(
                            children: [
                              SkeletonBox(width: 64, height: 24, radius: AppRadius.pill),
                              SizedBox(width: 6),
                              SkeletonBox(width: 96, height: 24, radius: AppRadius.pill),
                              SizedBox(width: 6),
                              SkeletonBox(width: 72, height: 24, radius: AppRadius.pill),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.xl),
                          const SkeletonBox(height: 48, radius: AppRadius.md),
                          const SizedBox(height: AppSpacing.sm + 2),
                          const Row(
                            children: [
                              SkeletonBox(width: 80, height: 38, radius: AppRadius.pill),
                              SizedBox(width: AppSpacing.sm),
                              SkeletonBox(width: 110, height: 38, radius: AppRadius.pill),
                              SizedBox(width: AppSpacing.sm),
                              SkeletonBox(width: 90, height: 38, radius: AppRadius.pill),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.md + AppSpacing.sm + 2),
                          LayoutBuilder(
                            builder: (context, constraints) => GridView.builder(
                              shrinkWrap: true,
                              padding: EdgeInsets.zero,
                              physics: const NeverScrollableScrollPhysics(),
                              gridDelegate: _gridDelegate(constraints.maxWidth, scaler),
                              itemCount: 6,
                              itemBuilder: (_, _) => const ShopProductTileSkeleton(),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xxl),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        _FloatingBack(top: top),
      ],
    );
  }
}

class _ShopDetailError extends ConsumerWidget {
  const _ShopDetailError({required this.shopId});

  final String shopId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final top = MediaQuery.paddingOf(context).top;
    return Stack(
      children: [
        EmptyState(
          title: ref.t('common.error'),
          illustration: AppIllustration.offline,
          actionLabel: ref.t('common.retry'),
          onAction: () => ref.invalidate(shopDetailProvider(shopId)),
        ),
        _FloatingBack(top: top),
      ],
    );
  }
}

class _FloatingBack extends StatelessWidget {
  const _FloatingBack({required this.top});

  final double top;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top + AppSpacing.sm,
      left: AppSpacing.page,
      child: AppIconButton(icon: LucideIcons.arrowLeft, bordered: false, shadow: true, onPressed: () => context.pop()),
    );
  }
}
