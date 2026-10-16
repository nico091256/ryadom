import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// Pill chip. Selected = solid ink (Uzum/Lavka style), unselected = light grey.
class AppChip extends StatelessWidget {
  const AppChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
    this.icon,
    this.leading,
    this.selectedColor = AppColors.ink900,
    this.compact = false,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final IconData? icon;
  final Widget? leading;
  final Color selectedColor;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? AppColors.white : AppColors.ink700;
    return Pressable(
      onTap: onTap,
      haptic: true,
      scale: 0.95,
      child: AnimatedContainer(
        duration: AppDurations.normal,
        curve: AppCurves.standard,
        height: compact ? 32 : 38,
        padding: EdgeInsets.symmetric(horizontal: compact ? 12 : 16),
        decoration: BoxDecoration(
          color: selected ? selectedColor : AppColors.ink100,
          borderRadius: AppRadius.chip,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (leading != null) ...[leading!, const SizedBox(width: 6)],
            if (icon != null) ...[Icon(icon, size: 16, color: fg), const SizedBox(width: 6)],
            Text(label, style: AppText.chip.copyWith(color: fg)),
          ],
        ),
      ),
    );
  }
}

/// Horizontally scrolling chip row with page gutters.
class AppChipRow extends StatelessWidget {
  const AppChipRow({super.key, required this.children, this.height = 38, this.padding = AppSpacing.pagePadding});

  final List<Widget> children;
  final double height;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        physics: const BouncingScrollPhysics(),
        itemCount: children.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (_, i) => children[i],
      ),
    );
  }
}
