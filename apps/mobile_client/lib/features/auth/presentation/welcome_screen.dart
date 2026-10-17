import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import 'widgets/language_segmented_control.dart';
import 'widgets/onboarding_slides.dart';

class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    final slides = [
      OnboardingSlide(illustration: AppIllustration.location, title: ref.t('welcome.slide1Title'), subtitle: ref.t('welcome.slide1Subtitle')),
      OnboardingSlide(illustration: AppIllustration.noShops, title: ref.t('welcome.slide2Title'), subtitle: ref.t('welcome.slide2Subtitle')),
      OnboardingSlide(illustration: AppIllustration.success, title: ref.t('welcome.slide3Title'), subtitle: ref.t('welcome.slide3Subtitle')),
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          Expanded(
            child: SafeArea(
              bottom: false,
              child: Column(
                children: [
                  const SizedBox(height: AppSpacing.lg),
                  const AppLogo(size: 38),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                      child: OnboardingSlides(slides: slides),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.xxl, AppSpacing.xl, AppSpacing.xl + bottomInset),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xxl)),
              boxShadow: AppShadows.lg,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(left: AppSpacing.xs),
                      child: Text(ref.t('welcome.chooseLanguage'), style: AppText.label),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    LanguageSegmentedControl(
                      value: locale,
                      onChanged: (lang) => ref.read(localeProvider.notifier).change(lang),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    AppButton(
                      label: ref.t('welcome.continue'),
                      icon: LucideIcons.arrowRight,
                      onPressed: () => context.go('/auth/phone'),
                    ),
                  ],
                ),
              ),
            ),
          ).animate().fadeIn(duration: AppDurations.slow).moveY(begin: 24, end: 0, curve: AppCurves.emphasized),
        ],
      ),
    );
  }
}
