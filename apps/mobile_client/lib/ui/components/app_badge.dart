import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';

enum BadgeTone { brand, neutral, warning, danger, info, accent, inverse }

/// Small status label (Ochiq / Yopiq / Yetkazilmoqda / -10% ...).
class AppBadge extends StatelessWidget {
  const AppBadge({
    super.key,
    required this.label,
    this.tone = BadgeTone.neutral,
    this.icon,
    this.dot = false,
    this.size = 12,
  });

  final String label;
  final BadgeTone tone;
  final IconData? icon;
  /// Leading status dot instead of an icon.
  final bool dot;
  final double size;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      BadgeTone.brand => (AppColors.green100, AppColors.green700),
      BadgeTone.neutral => (AppColors.ink100, AppColors.ink600),
      BadgeTone.warning => (AppColors.warningSoft, const Color(0xFFB45309)),
      BadgeTone.danger => (AppColors.dangerSoft, AppColors.danger),
      BadgeTone.info => (AppColors.infoSoft, const Color(0xFF1D4ED8)),
      BadgeTone.accent => (AppColors.orange500, AppColors.white),
      BadgeTone.inverse => (AppColors.ink900, AppColors.white),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: AppRadius.chip),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(width: 6, height: 6, decoration: BoxDecoration(color: fg, shape: BoxShape.circle)),
            const SizedBox(width: 5),
          ] else if (icon != null) ...[
            Icon(icon, size: size + 1, color: fg),
            const SizedBox(width: 4),
          ],
          Text(label, style: AppText.captionStrong.copyWith(color: fg, fontSize: size)),
        ],
      ),
    );
  }
}
