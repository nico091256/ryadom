import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../location/presentation/address_controller.dart';

/// Top section of Home per user spec:
/// Level 1 (Hero):
///   - Compact delivery address strip ("Yetkazish manzili: Qorasuv 4, 12-uy ▾") + Map Toggle
///   - Large hero headline (28-30px Manrope 800): "Nima buyurtma qilamiz, Sardor?"
///   - Rich Hero Banner: "Issiq non — 10 daqiqada" with gradient and callout
class HomeHeader extends ConsumerWidget {
  const HomeHeader({
    super.key,
    required this.mapMode,
    required this.onToggleMap,
    required this.onAddressTap,
  });

  final bool mapMode;
  final VoidCallback onToggleMap;
  final VoidCallback onAddressTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final address = ref.watch(addressControllerProvider.select((a) => a.addressText));
    final user = ref.watch(authControllerProvider).value;
    final userName = user?.name != null && user!.name!.trim().isNotEmpty
        ? user.name!.trim().split(' ').first
        : null;

    final headline = userName != null ? ref.t('home.greeting', {'name': userName}) : ref.t('home.greetingAnon');

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.md, AppSpacing.page, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Top Bar: Delivery Address selector + Map toggle
          Row(
            children: [
              Expanded(
                child: Pressable(
                  onTap: onAddressTap,
                  haptic: true,
                  scale: 0.98,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      boxShadow: AppShadows.xs,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.mapPin, size: 16, color: AppColors.accent),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            address.isNotEmpty ? address : ref.t('home.addressEmpty'),
                            style: AppText.captionStrong.copyWith(color: AppColors.textPrimary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(LucideIcons.chevronDown, size: 14, color: AppColors.textSecondary),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              MapToggleButton(
                mapMode: mapMode,
                onPressed: onToggleMap,
                tooltip: ref.t(mapMode ? 'home.listView' : 'home.mapView'),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.lg),

          // 2. Large Hero Headline (28-30px, 800 weight, -0.5 letter-spacing)
          Text(
            headline,
            style: AppText.sarlavhaL.copyWith(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              color: AppColors.textPrimary,
              height: 1.15,
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // 3. Hero Banner: "Issiq non — 10 daqiqada"
          const _HomeHeroBanner(),
        ],
      ),
    );
  }
}

/// Hero banner — the visual anchor of Home. Brand gradient + the app's own
/// illustration, so it ships with the build (no third-party photo fetched at
/// runtime) and no BackdropFilter inside the scroll view.
class _HomeHeroBanner extends ConsumerWidget {
  const _HomeHeroBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: double.infinity,
      height: 156,
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(AppRadius.rCard),
        boxShadow: AppShadows.brand,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Soft light bloom top-right so the gradient doesn't look flat.
          Positioned(
            right: -40,
            top: -60,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.white.withValues(alpha: 0.08)),
            ),
          ),
          Positioned(
            right: AppSpacing.md,
            bottom: -8,
            child: Opacity(opacity: 0.95, child: const Illustration(AppIllustration.success, size: 132)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.lg, 136, AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    border: Border.all(color: AppColors.white.withValues(alpha: 0.28), width: 0.8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(LucideIcons.zap, size: 12, color: AppColors.accent),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          ref.t('home.heroChip'),
                          style: AppText.micro.copyWith(color: AppColors.white),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  ref.t('home.heroTitle'),
                  style: AppText.sarlavhaM.copyWith(color: AppColors.white, letterSpacing: -0.3),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  ref.t('home.heroSubtitle'),
                  style: AppText.caption.copyWith(color: AppColors.white.withValues(alpha: 0.88)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Address pill used over map mode
class AddressPill extends StatelessWidget {
  const AddressPill({
    super.key,
    required this.label,
    required this.address,
    required this.onTap,
    this.elevated = false,
    this.emptyLabel = '—',
  });

  final String label;
  final String address;
  final VoidCallback onTap;
  final bool elevated;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      haptic: true,
      elevated: elevated,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(color: AppColors.accentLight, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: const Icon(LucideIcons.mapPin, size: 20, color: AppColors.accent),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label, style: AppText.izoh, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(address.isEmpty ? emptyLabel : address, style: AppText.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          const Icon(LucideIcons.pencil, size: 18, color: AppColors.textSecondary),
        ],
      ),
    );
  }
}

/// 44-50px square toggle; inverts to ink when the map is showing.
class MapToggleButton extends StatelessWidget {
  const MapToggleButton({
    super.key,
    required this.mapMode,
    required this.onPressed,
    this.tooltip,
    this.shadow = false,
  });

  final bool mapMode;
  final VoidCallback onPressed;
  final String? tooltip;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    return AppIconButton(
      icon: mapMode ? LucideIcons.list : LucideIcons.map,
      size: 44,
      iconSize: 20,
      onPressed: onPressed,
      tooltip: tooltip,
      shadow: shadow,
      bordered: !shadow,
      background: mapMode ? AppColors.brand : AppColors.surface,
      foreground: mapMode ? AppColors.white : AppColors.textPrimary,
    );
  }
}
