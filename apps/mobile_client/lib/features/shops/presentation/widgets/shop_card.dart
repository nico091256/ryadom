import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../domain/shop.dart';

const double _logoSize = 44;
const double _logoOverlap = 24;

/// 16:9 at phone widths; capped so the cover doesn't balloon at the 560px
/// desktop/tablet content width.
double _coverHeightFor(double width) => math.min((width * 9 / 16).roundToDouble(), 220);

/// Large shop card: 16:9 cover, overlapping logo, open badge, meta row.
class ShopCard extends ConsumerWidget {
  const ShopCard({super.key, required this.shop, required this.onTap});

  final Shop shop;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(localeProvider);
    final open = shop.isCurrentlyOpen;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final coverHeight = _coverHeightFor(width);
        return AppCard(
          onTap: onTap,
          padding: EdgeInsets.zero,
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Cover(url: shop.logoUrl, width: width, height: coverHeight),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.lg, _logoOverlap + AppSpacing.sm, AppSpacing.lg, AppSpacing.lg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(shop.name, style: AppText.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: AppSpacing.xs),
                        Text(shop.addressText, style: AppText.bodySm, maxLines: 1, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: AppSpacing.md),
                        ShopMetaRow(
                          distance: formatDistance(shop.distanceMeters, lang),
                          hours: '${shop.openTime}–${shop.closeTime}',
                          products: ref.t('home.productCount', {'count': '${shop.productCount}'}),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Positioned(
                top: AppSpacing.md,
                right: AppSpacing.md,
                child: ShopOpenBadge(open: open, label: ref.t(open ? 'home.open' : 'home.closed')),
              ),
              Positioned(
                left: AppSpacing.lg,
                top: coverHeight - _logoOverlap,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(color: AppColors.white, shape: BoxShape.circle, boxShadow: AppShadows.sm),
                  child: AppAvatar(url: shop.logoUrl, name: shop.name, size: _logoSize),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({required this.url, required this.width, required this.height});

  final String? url;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      return Container(
        width: width,
        height: height,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.green50, AppColors.ink50],
          ),
        ),
        alignment: Alignment.center,
        child: const Icon(LucideIcons.store, size: 40, color: AppColors.green300),
      );
    }
    return AppImage(
      url: url,
      width: width,
      height: height,
      radius: BorderRadius.zero,
      fallbackIcon: LucideIcons.store,
      fallbackColor: AppColors.green50,
    );
  }
}

/// "Ochiq" (brand, dot) / "Yopiq" (warning) badge shared by list, map and preview.
class ShopOpenBadge extends StatelessWidget {
  const ShopOpenBadge({super.key, required this.open, required this.label, this.size = 12});

  final bool open;
  final String label;
  final double size;

  @override
  Widget build(BuildContext context) {
    return AppBadge(label: label, tone: open ? BadgeTone.brand : BadgeTone.warning, dot: true, size: size);
  }
}

/// distance · hours · products, each with a small lucide glyph.
class ShopMetaRow extends StatelessWidget {
  const ShopMetaRow({super.key, required this.distance, required this.hours, this.products});

  final String distance;
  final String hours;
  final String? products;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Meta(icon: LucideIcons.navigation, text: distance),
        const _Dot(),
        _Meta(icon: LucideIcons.clock, text: hours),
        if (products != null) ...[
          const _Dot(),
          Flexible(child: _Meta(icon: LucideIcons.package, text: products!)),
        ],
      ],
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.ink400),
        const SizedBox(width: AppSpacing.xs),
        Flexible(child: Text(text, style: AppText.caption, maxLines: 1, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 3,
      height: 3,
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      decoration: const BoxDecoration(color: AppColors.ink300, shape: BoxShape.circle),
    );
  }
}

/// Loading placeholder shaped like [ShopCard].
class ShopCardSkeleton extends StatelessWidget {
  const ShopCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final coverHeight = _coverHeightFor(width);
        return AppCard(
          padding: EdgeInsets.zero,
          child: Skeleton(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: width, height: coverHeight, radius: 0),
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonLine(width: width * 0.55, height: 16),
                      const SizedBox(height: AppSpacing.sm),
                      SkeletonLine(width: width * 0.8),
                      const SizedBox(height: AppSpacing.md),
                      const Row(
                        children: [
                          SkeletonLine(width: 48),
                          SizedBox(width: AppSpacing.md),
                          SkeletonLine(width: 84),
                          SizedBox(width: AppSpacing.md),
                          SkeletonLine(width: 72),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
