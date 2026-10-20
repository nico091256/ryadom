import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../domain/eta.dart';
import '../../domain/shop.dart';

/// 16:9 ratio at phone widths; capped so the card doesn't balloon at 560px.
double _coverHeightFor(double width) => math.min((width * 9 / 16).roundToDouble(), 240);

/// Full-photo shop card: the shop's own photo (server-relative paths are
/// resolved, cached and decoded at display size), a bottom gradient with the
/// name/address inside the photo, and a translucent status pill
/// "● Ochiq · 350 m · ~12 daq". No blur filters — a flat 45% black pill reads
/// the same and stays cheap in a scrolling list.
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
        final height = _coverHeightFor(width);

        return AppCard(
          onTap: onTap,
          padding: EdgeInsets.zero,
          radius: AppRadius.card,
          elevated: true,
          child: SizedBox(
            width: width,
            height: height,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // No Hero here on purpose: a flight whose destination gets rebuilt
                // (list refresh, "last order" card appearing after checkout) is
                // aborted by Flutter and leaves this child hidden — the card then
                // shows only its dark gradient. The slide page transition is enough.
                ShopCover(url: shop.logoUrl, width: width, height: height),
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0.0, 0.45, 0.75, 1.0],
                        colors: [Color(0x33000000), Color(0x10000000), Color(0x8A000000), Color(0xDF000000)],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: AppSpacing.md,
                  left: AppSpacing.md,
                  child: ShopStatusPill(
                    open: open,
                    openLabel: ref.t(open ? 'home.open' : 'home.closed'),
                    distance: formatDistance(shop.distanceMeters, lang),
                    eta: ref.t('home.eta', {'min': '${estimateEtaMinutes(shop.distanceMeters)}'}),
                  ),
                ),
                Positioned(
                  left: AppSpacing.lg,
                  right: AppSpacing.lg,
                  bottom: AppSpacing.lg,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              shop.name,
                              style: AppText.sarlavhaM.copyWith(
                                color: AppColors.white,
                                letterSpacing: -0.3,
                                shadows: const [Shadow(color: Color(0x66000000), blurRadius: 8, offset: Offset(0, 2))],
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.white.withValues(alpha: 0.22),
                              borderRadius: BorderRadius.circular(AppRadius.pill),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(LucideIcons.clock, size: 12, color: AppColors.white),
                                const SizedBox(width: 4),
                                Text('${shop.openTime}–${shop.closeTime}', style: AppText.micro.copyWith(color: AppColors.white)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        shop.addressText,
                        style: AppText.izoh.copyWith(
                          color: AppColors.white.withValues(alpha: 0.88),
                          shadows: const [Shadow(color: Color(0x66000000), blurRadius: 6, offset: Offset(0, 1))],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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

/// The shop's cover photo (its uploaded logo/photo) with a brand-gradient
/// fallback. Shared by the Home card and the shop page app bar so the Hero
/// flight shows the same pixels.
class ShopCover extends StatelessWidget {
  const ShopCover({super.key, required this.url, required this.width, required this.height});

  final String? url;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      return DecoratedBox(
        decoration: const BoxDecoration(gradient: AppColors.brandGradient),
        child: Center(child: Icon(LucideIcons.store, size: 56, color: AppColors.white.withValues(alpha: 0.4))),
      );
    }
    return AppImage(
      url: url,
      width: width,
      height: height,
      radius: BorderRadius.zero,
      fit: BoxFit.cover,
      fallbackIcon: LucideIcons.store,
      fallbackColor: AppColors.green100,
      memCacheWidth: 1200,
    );
  }
}

/// "● Ochiq · 350 m · ~12 daq" pill for photo overlays.
class ShopStatusPill extends StatelessWidget {
  const ShopStatusPill({
    super.key,
    required this.open,
    required this.openLabel,
    required this.distance,
    required this.eta,
  });

  final bool open;
  final String openLabel;
  final String distance;
  final String eta;

  @override
  Widget build(BuildContext context) {
    final dotColor = open ? AppColors.green400 : AppColors.warning;
    final text = AppText.micro.copyWith(color: AppColors.white, letterSpacing: 0.2);
    final dot = Text(' · ', style: AppText.micro.copyWith(color: AppColors.white.withValues(alpha: 0.7)));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.ink900.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: AppColors.white.withValues(alpha: 0.2), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: dotColor,
              boxShadow: [BoxShadow(color: dotColor.withValues(alpha: 0.6), blurRadius: 6)],
            ),
          ),
          const SizedBox(width: 6),
          Text(openLabel, style: text),
          dot,
          Text(distance, style: text),
          dot,
          Text(eta, style: text),
        ],
      ),
    );
  }
}

/// "Ochiq" (brand, dot) / "Yopiq" (warning) badge shared by other screens.
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

/// Compact meta row: "350 m · 08:00–22:00 · 48 mahsulot"
class ShopMetaRow extends StatelessWidget {
  const ShopMetaRow({
    super.key,
    required this.distance,
    required this.hours,
    this.products,
    this.compact = false,
  });

  final String distance;
  final String hours;
  final String? products;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final style = compact ? AppText.caption : AppText.bodySm;
    final dot = Text(' · ', style: style);
    return Row(
      children: [
        Icon(LucideIcons.mapPin, size: compact ? 12 : 14, color: AppColors.textSecondary),
        const SizedBox(width: AppSpacing.xxs),
        Text(distance, style: style),
        dot,
        Icon(LucideIcons.clock, size: compact ? 12 : 14, color: AppColors.textSecondary),
        const SizedBox(width: AppSpacing.xxs),
        Text(hours, style: style),
        if (products != null) ...[
          dot,
          Expanded(child: Text(products!, style: style, maxLines: 1, overflow: TextOverflow.ellipsis)),
        ],
      ],
    );
  }
}

/// Shimmer skeleton matching the 16:9 ShopCard.
class ShopCardSkeleton extends StatelessWidget {
  const ShopCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final height = _coverHeightFor(width);
        return AppCard(
          padding: EdgeInsets.zero,
          radius: AppRadius.card,
          elevated: true,
          child: Skeleton(
            child: SizedBox(
              width: width,
              height: height,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  const SkeletonBox(width: double.infinity, height: double.infinity, radius: 0),
                  const Positioned(
                    top: AppSpacing.md,
                    left: AppSpacing.md,
                    child: SkeletonBox(width: 140, height: 26, radius: AppRadius.pill),
                  ),
                  Positioned(
                    left: AppSpacing.lg,
                    right: AppSpacing.lg,
                    bottom: AppSpacing.lg,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SkeletonBox(width: width * 0.5, height: 20, radius: 4),
                        const SizedBox(height: 6),
                        SkeletonBox(width: width * 0.35, height: 14, radius: 4),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
