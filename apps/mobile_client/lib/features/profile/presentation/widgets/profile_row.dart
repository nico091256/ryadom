import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

/// ListTile-like 56px row for settings sections: optional leading icon tile,
/// title/subtitle, and a chevron (or a brand check when [selected]).
class ProfileRow extends StatelessWidget {
  const ProfileRow({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.onTap,
    this.selected = false,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool selected;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final trailingWidget = trailing ??
        AnimatedSwitcher(
          duration: AppDurations.normal,
          switchInCurve: AppCurves.spring,
          child: selected
              ? const Icon(LucideIcons.check, key: ValueKey('check'), size: 20, color: AppColors.brand)
              : const Icon(LucideIcons.chevronRight, key: ValueKey('chevron'), size: 18, color: AppColors.ink300),
        );

    return Pressable(
      onTap: onTap,
      scale: 0.99,
      child: SizedBox(
        height: 56,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: Row(
            children: [
              if (icon != null) ...[
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(color: AppColors.ink50, borderRadius: BorderRadius.circular(AppRadius.sm)),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 18, color: AppColors.ink700),
                ),
                const SizedBox(width: AppSpacing.md),
              ],
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: selected ? AppText.bodyStrong : AppText.bodyMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subtitle != null) Text(subtitle!, style: AppText.caption, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              trailingWidget,
            ],
          ),
        ),
      ),
    );
  }
}

/// Divider aligned with the row text (indented past the icon tile when rows
/// have icons).
class ProfileRowDivider extends StatelessWidget {
  const ProfileRowDivider({super.key, this.indentForIcon = false});

  final bool indentForIcon;

  @override
  Widget build(BuildContext context) {
    return Divider(
      color: AppColors.divider,
      indent: AppSpacing.lg + (indentForIcon ? 36 + AppSpacing.md : 0),
      endIndent: AppSpacing.lg,
    );
  }
}
