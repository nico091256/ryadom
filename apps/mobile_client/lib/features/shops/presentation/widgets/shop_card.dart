import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../domain/shop.dart';

/// 16:9 ratio at phone widths; capped so the card doesn't balloon at 560px
double _coverHeightFor(double width) => math.min((width * 9 / 16).roundToDouble(), 240);

/// Curated high-res food & grocery covers for demo shops (appetizing, crisp)
const List<String> _curatedCovers = [
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80', // Fresh grocery market
  'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80', // Artisan bakery / hot bread
  'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1200&q=80', // Supermarket fresh fruits
  'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1200&q=80', // Modern market aisle
];

/// Premium ShopCard per User Spec:
/// - Full-width 16:9 photo with Hero transition
/// - Frosted glass pill overlay: "Ochiq · 350 m · 10–15 daq"
/// - Bottom dark gradient with crisp white Manrope 800 title + subtext inside the photo
/// - Two-tier soft shadow, no harsh border
class ShopCard extends ConsumerWidget {
  const ShopCard({super.key, required this.shop, required this.onTap});

  final Shop shop;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(localeProvider);
    final open = shop.isCurrentlyOpen;
    final distance = formatDistance(shop.distanceMeters, lang);

    // Pick a curated high-res cover if the shop's logo is empty or generic
    final coverUrl = (shop.logoUrl != null && shop.logoUrl!.startsWith('http'))
        ? shop.logoUrl!
        : _curatedCovers[shop.name.hashCode.abs() % _curatedCovers.length];

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
                // 1. 16:9 Image with Hero transition
                Hero(
                  tag: 'shop_cover_${shop.id}',
                  child: Image.network(
                    coverUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF147558), Color(0xFF0F5C45)],
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(LucideIcons.store, size: 48, color: AppColors.white),
                    ),
                  ),
                ),

                // 2. Multi-stop smooth dark gradient for text readability
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0.0, 0.45, 0.75, 1.0],
                        colors: [
                          Color(0x33000000),
                          Color(0x10000000),
                          Color(0x8A000000),
                          Color(0xDF000000),
                        ],
                      ),
                    ),
                  ),
                ),

                // 3. Frosted glass pill at top-left: "Ochiq · 350 m · 10–15 daq"
                Positioned(
                  top: AppSpacing.md,
                  left: AppSpacing.md,
                  child: _FrostedMetaBadge(
                    open: open,
                    openLabel: ref.t(open ? 'home.open' : 'home.closed'),
                    distance: distance,
                    eta: '10–15 daq',
                  ),
                ),

                // 4. Shop info inside the photo at the bottom
                Positioned(
                  left: AppSpacing.lg,
                  right: AppSpacing.lg,
                  bottom: AppSpacing.lg,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: Text(
                              shop.name,
                              style: AppText.sarlavhaM.copyWith(
                                color: AppColors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.3,
                                shadows: const [
                                  Shadow(color: Color(0x66000000), blurRadius: 8, offset: Offset(0, 2)),
                                ],
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
                                Text(
                                  '${shop.openTime}–${shop.closeTime}',
                                  style: AppText.micro.copyWith(color: AppColors.white, fontWeight: FontWeight.w700),
                                ),
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
                          fontSize: 13,
                          shadows: const [
                            Shadow(color: Color(0x66000000), blurRadius: 6, offset: Offset(0, 1)),
                          ],
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

/// Frosted glass (shisha) pill with blur filter:
/// "● Ochiq · 350 m · 10–15 daq"
class _FrostedMetaBadge extends StatelessWidget {
  const _FrostedMetaBadge({
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
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.38),
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(color: Colors.white.withValues(alpha: 0.2), width: 0.8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Pulsing green/warning status dot
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: open ? const Color(0xFF22C55E) : const Color(0xFFF59E0B),
                  boxShadow: [
                    BoxShadow(
                      color: (open ? const Color(0xFF22C55E) : const Color(0xFFF59E0B)).withValues(alpha: 0.6),
                      blurRadius: 6,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Text(
                openLabel,
                style: AppText.micro.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
              Text(
                ' · ',
                style: AppText.micro.copyWith(color: Colors.white70),
              ),
              Text(
                distance,
                style: AppText.micro.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
              Text(
                ' · ',
                style: AppText.micro.copyWith(color: Colors.white70),
              ),
              Text(
                eta,
                style: AppText.micro.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
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

/// Shimmer skeleton matching the 16:9 premium ShopCard
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

