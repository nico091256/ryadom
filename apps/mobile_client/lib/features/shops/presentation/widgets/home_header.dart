import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../location/presentation/address_controller.dart';

/// Top row of Home: delivery-address pill + list/map toggle.
class HomeHeader extends ConsumerWidget {
  const HomeHeader({super.key, required this.mapMode, required this.onToggleMap, required this.onAddressTap});

  final bool mapMode;
  final VoidCallback onToggleMap;
  final VoidCallback onAddressTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final address = ref.watch(addressControllerProvider.select((a) => a.addressText));
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.md, AppSpacing.page, 0),
      child: Row(
        children: [
          Expanded(
            child: AddressPill(
              label: ref.t('home.deliverTo'),
              address: address,
              emptyLabel: ref.t('home.addressEmpty'),
              onTap: onAddressTap,
            ),
          ),
          const SizedBox(width: AppSpacing.sm + AppSpacing.xxs),
          MapToggleButton(mapMode: mapMode, onPressed: onToggleMap, tooltip: ref.t(mapMode ? 'home.listView' : 'home.mapView')),
        ],
      ),
    );
  }
}

/// "Yetkazish manzili / <address> ✎" card. Also floats over the map.
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
  /// Shown when no address has been chosen yet.
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

/// 56px square toggle; inverts to ink when the map is showing.
class MapToggleButton extends StatelessWidget {
  const MapToggleButton({super.key, required this.mapMode, required this.onPressed, this.tooltip, this.shadow = false});

  final bool mapMode;
  final VoidCallback onPressed;
  final String? tooltip;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    return AppIconButton(
      icon: mapMode ? LucideIcons.list : LucideIcons.map,
      size: 56,
      iconSize: 22,
      onPressed: onPressed,
      tooltip: tooltip,
      shadow: shadow,
      bordered: !shadow,
      background: mapMode ? AppColors.ink900 : AppColors.surface,
      foreground: mapMode ? AppColors.white : AppColors.textPrimary,
    );
  }
}

