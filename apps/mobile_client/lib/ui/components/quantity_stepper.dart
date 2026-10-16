import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// "+" that morphs into a [−  n  +] control once something is in the cart.
/// `max` greys out "+" at the stock limit. Width animates so grids don't jump.
class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onIncrement,
    required this.onDecrement,
    this.max,
    this.enabled = true,
    this.size = 36,
    this.addLabel,
    this.compact = false,
  });

  final int quantity;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final int? max;
  final bool enabled;
  final double size;
  /// Label for the collapsed "+" state, e.g. "Qo'shish". Null → icon only.
  final String? addLabel;
  /// Icon-only round "+" (for product grid tiles).
  final bool compact;

  bool get _canAdd => enabled && (max == null || quantity < max!);

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
    final child = Container(
      height: size,
      padding: EdgeInsets.symmetric(horizontal: compact || addLabel == null ? 0 : 14),
      width: compact || addLabel == null ? size : null,
      decoration: BoxDecoration(
        color: _canAdd ? AppColors.brand : AppColors.ink200,
        borderRadius: BorderRadius.circular(compact ? size / 2 : AppRadius.sm),
        boxShadow: _canAdd && !compact ? AppShadows.brand : null,
      ),
      alignment: Alignment.center,
      child: addLabel == null || compact
          ? const Icon(LucideIcons.plus, size: 18, color: AppColors.white)
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.plus, size: 16, color: AppColors.white),
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
      decoration: BoxDecoration(
        color: AppColors.brand,
        borderRadius: BorderRadius.circular(compact ? size / 2 : AppRadius.sm),
        boxShadow: compact ? null : AppShadows.brand,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepButton(icon: quantity == 1 ? LucideIcons.trash2 : LucideIcons.minus, onTap: _tapDecrement, size: size),
          AnimatedSwitcher(
            duration: AppDurations.fast,
            transitionBuilder: (child, anim) => FadeTransition(
              opacity: anim,
              child: ScaleTransition(scale: Tween(begin: 0.7, end: 1.0).animate(anim), child: child),
            ),
            child: SizedBox(
              key: ValueKey(quantity),
              width: 28,
              child: Text(
                '$quantity',
                textAlign: TextAlign.center,
                style: AppText.numeric.copyWith(color: AppColors.white, fontSize: 15).weight(700),
              ),
            ),
          ),
          _StepButton(icon: LucideIcons.plus, onTap: _canAdd ? _tapIncrement : null, size: size),
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
  const _StepButton({required this.icon, required this.onTap, required this.size});

  final IconData icon;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      enabled: onTap != null,
      scale: 0.85,
      child: SizedBox(
        width: size,
        height: size,
        child: Icon(icon, size: 17, color: onTap == null ? AppColors.white.withValues(alpha: 0.4) : AppColors.white),
      ),
    );
  }
}
