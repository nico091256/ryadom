import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// "+" that morphs into a white capsule [−  n  +] (green outline, round green
/// "+") once something is in the cart. `max` greys out "+" at the stock limit,
/// "−" turns into a bin at quantity 1. Every dimension derives from [size] so
/// the same control works at 34px on photo tiles and 44px in lists.
class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onIncrement,
    required this.onDecrement,
    this.max,
    this.enabled = true,
    this.size = 44,
    this.addLabel,
    this.compact = false,
  });

  final int quantity;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final int? max;
  final bool enabled;
  /// Control height; buttons and type scale from it.
  final double size;
  /// Label for the collapsed "+" state, e.g. "Qo'shish". Null → icon only.
  final String? addLabel;
  /// Icon-only round "+" (for product grid tiles).
  final bool compact;

  bool get _canAdd => enabled && (max == null || quantity < max!);
  double get _iconSize => (size * 0.42).clamp(14, 20);
  double get _button => size - 4;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: AppDurations.normal,
      curve: AppCurves.standard,
      alignment: Alignment.centerRight,
      child: quantity == 0 ? _addButton() : _stepper(),
    );
  }

  Widget _addButton() {
    final iconOnly = compact || addLabel == null;
    final child = Container(
      height: size,
      width: iconOnly ? size : null,
      padding: EdgeInsets.symmetric(horizontal: iconOnly ? 0 : 16),
      decoration: BoxDecoration(
        color: _canAdd ? AppColors.brand : AppColors.border,
        borderRadius: BorderRadius.circular(size / 2),
        boxShadow: _canAdd && !compact ? AppShadows.brand : null,
      ),
      alignment: Alignment.center,
      child: iconOnly
          ? Icon(LucideIcons.plus, size: _iconSize, color: AppColors.white)
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.plus, size: _iconSize, color: AppColors.white),
                const SizedBox(width: 6),
                Text(addLabel!, style: AppText.buttonSm.copyWith(color: AppColors.white)),
              ],
            ),
    );
    return Pressable(
      key: const ValueKey('add'),
      onTap: _canAdd ? _tapIncrement : null,
      enabled: _canAdd,
      scale: 0.9,
      child: child,
    );
  }

  Widget _stepper() {
    return Container(
      key: const ValueKey('stepper'),
      height: size,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(size / 2),
        border: Border.all(color: AppColors.brand, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepButton(
            icon: quantity == 1 ? LucideIcons.trash2 : LucideIcons.minus,
            onTap: _tapDecrement,
            size: _button,
            iconSize: _iconSize,
            color: AppColors.brand,
          ),
          AnimatedSwitcher(
            duration: AppDurations.fast,
            transitionBuilder: (child, anim) => FadeTransition(
              opacity: anim,
              child: ScaleTransition(scale: Tween(begin: 0.7, end: 1.0).animate(anim), child: child),
            ),
            child: SizedBox(
              key: ValueKey(quantity),
              width: compact ? 22 : 28,
              child: Text(
                '$quantity',
                textAlign: TextAlign.center,
                style: AppText.numeric.copyWith(fontSize: (size * 0.36).clamp(13, 16)).weight(800),
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              color: _canAdd ? AppColors.brand : AppColors.ink200,
              shape: BoxShape.circle,
            ),
            child: _StepButton(
              icon: LucideIcons.plus,
              onTap: _canAdd ? _tapIncrement : null,
              size: _button,
              iconSize: _iconSize,
              color: AppColors.white,
            ),
          ),
        ],
      ),
    );
  }

  void _tapIncrement() {
    HapticFeedback.lightImpact();
    onIncrement();
  }

  void _tapDecrement() {
    HapticFeedback.selectionClick();
    onDecrement();
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.onTap,
    required this.size,
    required this.iconSize,
    required this.color,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final double size;
  final double iconSize;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      enabled: onTap != null,
      scale: 0.85,
      child: SizedBox(
        width: size,
        height: size,
        child: Icon(icon, size: iconSize, color: onTap == null ? color.withValues(alpha: 0.6) : color),
      ),
    );
  }
}
