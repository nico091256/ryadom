import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/providers.dart';
import '../../auth/presentation/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value;
    final locale = ref.watch(localeProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('profile.title'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppTheme.seed.withValues(alpha: 0.15),
                  child: Text(
                    _avatarInitial(user?.name, user?.phone),
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppTheme.seed),
                  ),
                ),
                const SizedBox(height: 10),
                Text(user?.name ?? ref.t('profile.defaultName'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                Text(user?.phone ?? '', style: const TextStyle(color: Color(0xFF64748B))),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text(ref.t('profile.appLanguage'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              _LangChip(label: "O'zbekcha", lang: SupportedLanguage.uz, current: locale),
              _LangChip(label: 'Русский', lang: SupportedLanguage.ru, current: locale),
              _LangChip(label: 'English', lang: SupportedLanguage.en, current: locale),
            ],
          ),
          const SizedBox(height: 32),
          OutlinedButton(
            style: OutlinedButton.styleFrom(foregroundColor: Colors.red, minimumSize: const Size.fromHeight(48)),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
            child: Text(ref.t('profile.logoutButton')),
          ),
        ],
      ),
    );
  }
}

String _avatarInitial(String? name, String? phone) {
  if (name != null && name.isNotEmpty) return name[0].toUpperCase();
  if (phone != null && phone.isNotEmpty) return phone.substring(phone.length - 1);
  return '?';
}

class _LangChip extends ConsumerWidget {
  const _LangChip({required this.label, required this.lang, required this.current});
  final String label;
  final SupportedLanguage lang;
  final SupportedLanguage current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = current == lang;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      selectedColor: AppTheme.seed.withValues(alpha: 0.15),
      labelStyle: TextStyle(color: selected ? AppTheme.seed : const Color(0xFF334155), fontWeight: FontWeight.w700),
      onSelected: (_) async {
        await ref.read(localeProvider.notifier).change(lang);
        await ref.read(authControllerProvider.notifier).changeLanguage(lang.value);
      },
    );
  }
}
