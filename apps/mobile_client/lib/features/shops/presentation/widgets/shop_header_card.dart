import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../domain/shop.dart';

/// White card that tucks under the cover photo: logo, name, address and the
/// open / hours / distance / free-delivery badges.
class ShopHeaderCard extends ConsumerWidget {
  const ShopHeaderCard({super.key, required this.shop});

  final Shop shop;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(localeProvider);
    final open = shop.isCurrentlyOpen;

    return AppCard(
      elevated: true,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _RingedAvatar(url: shop.logoUrl, name: shop.name),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(shop.name, style: AppText.h2, maxLines: 2, overflow: TextOverflow.ellipsis),
                    if (shop.addressText.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Row(
                        children: [
                          const Icon(LucideIcons.mapPin, size: 13, color: AppColors.textTertiary),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Text(shop.addressText, style: AppText.caption, maxLines: 1, overflow: TextOverflow.ellipsis),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              AppBadge(
                label: ref.t(open ? 'home.open' : 'home.closed'),
                tone: open ? BadgeTone.brand : BadgeTone.neutral,
                dot: true,
              ),
              AppBadge(label: '${shop.openTime}–${shop.closeTime}', icon: LucideIcons.clock),
              if (shop.distanceMeters > 0)
                AppBadge(label: formatDistance(shop.distanceMeters, lang), icon: LucideIcons.navigation),
              AppBadge(label: ref.t('shop.freeDelivery'), tone: BadgeTone.brand, icon: LucideIcons.bike),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingedAvatar extends StatelessWidget {
  const _RingedAvatar({required this.url, required this.name});

  final String? url;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: const BoxDecoration(color: AppColors.white, shape: BoxShape.circle, boxShadow: AppShadows.sm),
      child: AppAvatar(url: url, name: name, size: 56),
    );
  }
}

/// Amber strip shown under the header when the shop is not taking orders.
class ShopClosedStrip extends ConsumerWidget {
  const ShopClosedStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm + 2),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: AppRadius.control,
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.alertTriangle, size: 18, color: AppColors.warning),
          const SizedBox(width: AppSpacing.sm + 2),
          Expanded(child: Text(ref.t('shop.closedBanner'), style: AppText.bodySmStrong.copyWith(color: AppColors.ink800))),
        ],
      ),
    );
  }
}
