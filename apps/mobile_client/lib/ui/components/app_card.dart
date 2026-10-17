import 'package:flutter/material.dart';

import '../tokens.dart';
import 'pressable.dart';

/// White surface on the grey page background. Either a hairline border
/// (`elevated: false`, the default for dense lists) or a soft shadow.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.margin,
    this.radius,
    this.elevated = false,
    this.color = AppColors.surface,
    this.borderColor,
    this.clip = Clip.antiAlias,
    this.haptic = false,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? radius;
  final bool elevated;
  final Color color;
  final Color? borderColor;
  final Clip clip;
  final bool haptic;

  @override
  Widget build(BuildContext context) {
    final r = radius ?? AppRadius.card;
    final card = Container(
      margin: margin,
      decoration: BoxDecoration(
        color: color,
        borderRadius: r,
        border: borderColor != null ? Border.all(color: borderColor!) : null,
        boxShadow: elevated || borderColor == null ? AppShadows.premium : null,
      ),
      clipBehavior: clip,
      child: Padding(padding: padding, child: child),
    );
    if (onTap == null) return card;
    return Pressable(onTap: onTap, haptic: haptic, scale: 0.98, borderRadius: r, child: card);
  }
}

/// Section wrapper used on checkout/profile: optional title row + card body.
class AppSection extends StatelessWidget {
  const AppSection({
    super.key,
    required this.child,
    this.title,
    this.trailing,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
  });

  final Widget child;
  final String? title;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.xs, bottom: AppSpacing.sm),
            child: Row(
              children: [
                Expanded(child: Text(title!, style: Theme.of(context).textTheme.titleMedium)),
                ?trailing,
              ],
            ),
          ),
        AppCard(padding: padding, child: child),
      ],
    );
  }
}
