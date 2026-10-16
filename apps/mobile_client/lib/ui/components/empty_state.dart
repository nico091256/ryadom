import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../illustrations.dart';
import '../tokens.dart';
import '../typography.dart';
import 'app_button.dart';

/// Centered illustration + title + optional subtitle + optional action.
/// Used for empty lists, errors and offline states so they all feel designed.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.subtitle,
    this.illustration = AppIllustration.empty,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  final String title;
  final String? subtitle;
  final AppIllustration illustration;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacing.xxxl, vertical: compact ? AppSpacing.lg : AppSpacing.huge),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Illustration(illustration, size: compact ? 120 : 168)
                .animate()
                .fadeIn(duration: AppDurations.slow)
                .scale(begin: const Offset(0.92, 0.92), end: const Offset(1, 1), curve: AppCurves.emphasized),
            SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xxl),
            Text(title, textAlign: TextAlign.center, style: AppText.h3)
                .animate(delay: 60.ms)
                .fadeIn(duration: AppDurations.slow)
                .moveY(begin: 8, end: 0, curve: AppCurves.standard),
            if (subtitle != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(subtitle!, textAlign: TextAlign.center, style: AppText.body.secondary)
                  .animate(delay: 120.ms)
                  .fadeIn(duration: AppDurations.slow)
                  .moveY(begin: 8, end: 0, curve: AppCurves.standard),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.xxl),
              AppButton(label: actionLabel!, onPressed: onAction, size: AppButtonSize.md, expand: false)
                  .animate(delay: 180.ms)
                  .fadeIn(duration: AppDurations.slow)
                  .moveY(begin: 8, end: 0, curve: AppCurves.standard),
            ],
          ],
        ),
      ),
    );
  }
}
