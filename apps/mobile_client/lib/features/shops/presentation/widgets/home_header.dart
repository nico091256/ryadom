import 'dart:ui';

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

    final headline = userName != null
        ? 'Nima buyurtma qilamiz, $userName?'
        : 'Nima buyurtma qilamiz?';

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

/// Rich Hero Banner: visual anchor of the Home screen
class _HomeHeroBanner extends StatelessWidget {
  const _HomeHeroBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 156,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.rCard),
        boxShadow: AppShadows.premium,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background photo (crisp warm bakery / fresh grocery)
          Image.network(
            'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=80',
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF0F5C45), Color(0xFF147558)],
                ),
              ),
            ),
          ),

          // Gradient for maximum contrast
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                stops: [0.0, 0.65, 1.0],
                colors: [
                  Color(0xF00F5C45),
                  Color(0xB30F5C45),
                  Color(0x330F5C45),
                ],
              ),
            ),
          ),

          // Content overlay
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Frosted pill
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.white.withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        border: Border.all(color: AppColors.white.withValues(alpha: 0.3), width: 0.8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.zap, size: 12, color: AppColors.accent),
                          const SizedBox(width: 5),
                          Text(
                            'Tezkor yetkazish',
                            style: AppText.micro.copyWith(color: AppColors.white, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Issiq non — 10 daqiqada',
                  style: AppText.sarlavhaM.copyWith(
                    color: AppColors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Yaqin atrofdagi do\'konlardan tez va oson',
                  style: AppText.caption.copyWith(
                    color: AppColors.white.withValues(alpha: 0.9),
                    fontSize: 12,
                  ),
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
