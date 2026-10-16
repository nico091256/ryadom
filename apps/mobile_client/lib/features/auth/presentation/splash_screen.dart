import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'widgets/brand_mark.dart';

/// Shown while the auth state is loading; the router redirects away from
/// here as soon as it knows whether there is a signed-in user.
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.brand,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppColors.brandGradient),
        child: SafeArea(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Inner animate = gentle breathing loop; outer = one-shot entrance.
                const BrandMark()
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .scaleXY(begin: 1, end: 1.04, duration: 1400.ms, curve: Curves.easeInOut)
                    .animate()
                    .fadeIn(duration: 400.ms)
                    .scale(begin: const Offset(0.8, 0.8), end: const Offset(1, 1), duration: 400.ms, curve: AppCurves.emphasized),
                const SizedBox(height: AppSpacing.xxl),
                Text(ref.t('common.appName'), style: AppText.h2.onBrand.copyWith(letterSpacing: -0.5))
                    .animate(delay: 120.ms)
                    .fadeIn(duration: AppDurations.slow)
                    .moveY(begin: 8, end: 0, curve: AppCurves.standard),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  ref.t('welcome.title'),
                  textAlign: TextAlign.center,
                  style: AppText.body.withColor(AppColors.white.withValues(alpha: 0.8)),
                ).animate(delay: 200.ms).fadeIn(duration: AppDurations.slow).moveY(begin: 8, end: 0, curve: AppCurves.standard),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
