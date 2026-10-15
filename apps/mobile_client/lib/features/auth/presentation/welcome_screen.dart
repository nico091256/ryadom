import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/providers.dart';

class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              const Icon(Icons.storefront_rounded, color: AppTheme.seed, size: 64),
              const SizedBox(height: 20),
              Text(
                ref.t('welcome.title'),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 10),
              Text(
                ref.t('welcome.subtitle'),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 32),
              Text(ref.t('welcome.chooseLanguage'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                children: [
                  _LanguageChip(label: "O'zbekcha", lang: SupportedLanguage.uz, selected: locale == SupportedLanguage.uz),
                  _LanguageChip(label: 'Русский', lang: SupportedLanguage.ru, selected: locale == SupportedLanguage.ru),
                  _LanguageChip(label: 'English', lang: SupportedLanguage.en, selected: locale == SupportedLanguage.en),
                ],
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => context.go('/auth/phone'),
                  child: Text(ref.t('welcome.continue')),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageChip extends ConsumerWidget {
  const _LanguageChip({required this.label, required this.lang, required this.selected});

  final String label;
  final SupportedLanguage lang;
  final bool selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      selectedColor: AppTheme.seed.withValues(alpha: 0.15),
      labelStyle: TextStyle(color: selected ? AppTheme.seed : const Color(0xFF334155), fontWeight: FontWeight.w700),
      onSelected: (_) => ref.read(localeProvider.notifier).change(lang),
    );
  }
}
