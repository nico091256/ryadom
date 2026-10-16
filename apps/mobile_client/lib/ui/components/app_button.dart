import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

enum AppButtonVariant { primary, secondary, ghost, danger, outline }

enum AppButtonSize { sm, md, lg }

/// The one button. Variants cover every CTA in the app; `loading` swaps the
/// label for a spinner while keeping the width stable.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.lg,
    this.icon,
    this.trailing,
    this.loading = false,
    this.expand = true,
    this.haptic = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final IconData? icon;
  final Widget? trailing;
  final bool loading;
  final bool expand;
  final bool haptic;

  bool get _enabled => onPressed != null && !loading;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border, shadow) = _palette();
    final height = switch (size) {
      AppButtonSize.sm => 40.0,
      AppButtonSize.md => kButtonHeightSecondary, // 48.0 per PDF
      AppButtonSize.lg => kButtonHeightPrimary,   // 56.0 per PDF
    };
    final textStyle = (size == AppButtonSize.sm ? AppText.buttonSm : AppText.button).copyWith(color: fg);
    final iconSize = size == AppButtonSize.sm ? 16.0 : 20.0;
    final hPad = switch (size) {
      AppButtonSize.sm => 14.0,
      AppButtonSize.md => 18.0,
      AppButtonSize.lg => 22.0,
    };

    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[
          Icon(icon, size: iconSize, color: fg),
          const SizedBox(width: AppSpacing.sm),
        ],
        Flexible(
          child: Text(label, style: textStyle, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
        ),
        if (trailing != null) ...[const SizedBox(width: AppSpacing.sm), trailing!],
      ],
    );

    return Pressable(
      onTap: _enabled ? onPressed : null,
      enabled: _enabled,
      haptic: haptic,
      scale: 0.97,
      child: AnimatedContainer(
        duration: AppDurations.normal,
        curve: AppCurves.standard,
        height: height,
        padding: EdgeInsets.symmetric(horizontal: hPad),
        decoration: BoxDecoration(
          color: _enabled ? bg : (variant == AppButtonVariant.primary ? AppColors.border : bg.withValues(alpha: 0.6)),
          borderRadius: AppRadius.control,
          border: border != null ? Border.all(color: border) : null,
          boxShadow: _enabled ? shadow : AppShadows.none,
        ),
        child: AnimatedSwitcher(
          duration: AppDurations.normal,
          child: loading
              ? SizedBox(
                  key: const ValueKey('spinner'),
                  width: iconSize,
                  height: iconSize,
                  child: CircularProgressIndicator(strokeWidth: 2.2, color: fg),
                )
              : KeyedSubtree(key: const ValueKey('label'), child: content),
        ),
      ),
    );
  }

  (Color, Color, Color?, List<BoxShadow>) _palette() => switch (variant) {
        AppButtonVariant.primary => (AppColors.brand, AppColors.surface, null, AppShadows.brand),
        AppButtonVariant.secondary => (AppColors.brandSoft, AppColors.brand, null, AppShadows.none),
        AppButtonVariant.ghost => (Colors.transparent, AppColors.textPrimary, null, AppShadows.none),
        AppButtonVariant.outline => (AppColors.surface, AppColors.textPrimary, AppColors.border, AppShadows.none),
        AppButtonVariant.danger => (AppColors.dangerSoft, AppColors.danger, null, AppShadows.none),
      };
}

/// Square icon-only button (44x44 tap target) for toolbars and cards.
class AppIconButton extends StatelessWidget {
  const AppIconButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.size = 40,
    this.iconSize = 20,
    this.background = AppColors.surface,
    this.foreground = AppColors.textPrimary,
    this.bordered = true,
    this.shadow = false,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final double size;
  final double iconSize;
  final Color background;
  final Color foreground;
  final bool bordered;
  final bool shadow;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = Pressable(
      onTap: onPressed,
      haptic: true,
      scale: 0.92,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(size / 2.8),
          border: bordered ? Border.all(color: AppColors.border) : null,
          boxShadow: shadow ? AppShadows.sm : null,
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: iconSize, color: onPressed == null ? AppColors.ink300 : foreground),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}
