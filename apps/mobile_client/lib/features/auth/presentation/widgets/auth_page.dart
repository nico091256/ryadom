import 'package:flutter/material.dart';

import '../../../../ui/ui.dart';

/// White auth page: optional back button, big title, secondary subtitle,
/// scrollable body and a sticky bottom CTA that stays above the keyboard.
/// Content is centred in a 420px column so it also reads well on desktop web.
class AuthPage extends StatelessWidget {
  const AuthPage({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.onBack,
    this.bottom,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final Widget child;
  final Widget? bottom;

  static const double maxWidth = 420;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: maxWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.sm, AppSpacing.page, 0),
                  child: SizedBox(
                    height: 40,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: onBack == null
                          ? null
                          : AppIconButton(icon: LucideIcons.arrowLeft, onPressed: onBack, tooltip: MaterialLocalizations.of(context).backButtonTooltip),
                    ),
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.xl, AppSpacing.xl, AppSpacing.xl),
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppText.h1)
                            .animate()
                            .fadeIn(duration: AppDurations.slow)
                            .moveY(begin: 8, end: 0, curve: AppCurves.standard),
                        if (subtitle != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Text(subtitle!, style: AppText.body.secondary)
                              .animate(delay: 60.ms)
                              .fadeIn(duration: AppDurations.slow)
                              .moveY(begin: 8, end: 0, curve: AppCurves.standard),
                        ],
                        const SizedBox(height: AppSpacing.xxxl),
                        child.animate(delay: 120.ms).fadeIn(duration: AppDurations.slow).moveY(begin: 8, end: 0, curve: AppCurves.standard),
                      ],
                    ),
                  ),
                ),
                if (bottom != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.md, AppSpacing.xl, AppSpacing.xl),
                    child: bottom,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
