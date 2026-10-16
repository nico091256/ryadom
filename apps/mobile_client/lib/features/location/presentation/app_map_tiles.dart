import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import '../../../ui/ui.dart';

/// CARTO "light_all" basemap — the one tile source every map in the app uses so
/// they all share the same calm, low-contrast look under the brand green.
TileLayer appTileLayer(BuildContext context) => TileLayer(
      urlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      subdomains: const ['a', 'b', 'c', 'd'],
      userAgentPackageName: 'uz.ryadom.mobile_client',
      retinaMode: RetinaMode.isHighDensity(context),
    );

/// Required attribution for the CARTO/OSM tiles, as a quiet pill.
class MapAttribution extends StatelessWidget {
  const MapAttribution({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(AppRadius.xs),
      ),
      child: Text('© OpenStreetMap, © CARTO', style: AppText.micro.copyWith(color: AppColors.ink500)),
    );
  }
}
