import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/providers.dart';
import '../../../core/utils/launch_url.dart';
import '../../../ui/ui.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../favorites/presentation/favorites_controller.dart';
import '../../orders/presentation/orders_history_controller.dart';
import 'widgets/edit_profile_sheet.dart';
import 'widgets/language_sheet.dart';
import 'widgets/profile_header.dart';
import 'widgets/profile_row.dart';

const double _kMaxContentWidth = 560;
const String _kAppVersion = '1.0.0';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _pickLanguage(BuildContext context, WidgetRef ref) async {
    final lang = await showLanguageSheet(context, ref);
    if (lang == null || !context.mounted) return;
    await _changeLanguage(context, ref, lang);
  }

  Future<void> _changeLanguage(BuildContext context, WidgetRef ref, SupportedLanguage lang) async {
    if (ref.read(localeProvider) == lang) return;
    // Persist locally first so the UI flips immediately, then sync the
    // preference to the profile (no-op for guests).
    await ref.read(localeProvider.notifier).change(lang);
    if (!context.mounted) return;
    try {
      await ref.read(authControllerProvider.notifier).changeLanguage(lang.value);
    } on AppException catch (e) {
      if (context.mounted) showAppToast(context, ref.errorText(e), tone: ToastTone.error);
    } on Exception {
      if (context.mounted) showAppToast(context, ref.t('common.error'), tone: ToastTone.error);
    }
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showAppConfirm(
      context,
      title: ref.t('profile.logoutButton'),
      message: ref.t('profile.logoutQuestion'),
      confirmLabel: ref.t('common.logout'),
      cancelLabel: ref.t('common.cancel'),
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;
    await ref.read(authControllerProvider.notifier).logout();
  }

  void _showSupport(BuildContext context, WidgetRef ref) {
    showAppSheet<void>(
      context,
      title: ref.t('profile.support'),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(ref.t('profile.supportSoon'), style: AppText.body.secondary),
          const SizedBox(height: AppSpacing.lg),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                ProfileRow(
                  icon: LucideIcons.send,
                  iconColor: const Color(0xFF0284C7),
                  iconBackground: const Color(0xFFE0F2FE),
                  title: 'Telegram',
                  subtitle: '@ryadom_support',
                  onTap: () => launchExternalUrl('https://t.me/ryadom_support'),
                ),
                const ProfileRowDivider(indentForIcon: true),
                ProfileRow(
                  icon: LucideIcons.phone,
                  iconColor: AppColors.brand,
                  iconBackground: AppColors.brandSoft,
                  title: '+998 71 200 00 00',
                  subtitle: '08:00 – 23:00',
                  onTap: () => launchCallerUrl('+998712000000'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showAbout(BuildContext context, WidgetRef ref) {
    showAppSheet<void>(
      context,
      title: ref.t('profile.about'),
      builder: (_) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(AppRadius.md)),
                alignment: Alignment.center,
                child: const Icon(LucideIcons.store, size: 26, color: AppColors.white),
              ),
              const SizedBox(width: AppSpacing.lg),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ref.t('common.appName'), style: AppText.h3),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(ref.t('profile.version', {'version': _kAppVersion}), style: AppText.caption),
                ],
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(ref.t('welcome.subtitle'), style: AppText.body.secondary),
          const SizedBox(height: AppSpacing.sm),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;
    final locale = ref.watch(localeProvider);
    final name = (user?.name ?? '').trim().isEmpty ? ref.t('profile.defaultName') : user!.name!.trim();

    final orders = user == null ? null : ref.watch(myOrdersProvider).valueOrNull;
    final favoriteCount = ref.watch(favoriteShopsProvider.select((ids) => ids.length));

    var sections = <Widget>[
      if (user != null)
        AppSection(
          title: ref.t('profile.mySection'),
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              ProfileRow(
                icon: LucideIcons.clipboardList,
                iconColor: AppColors.brand,
                iconBackground: AppColors.brandSoft,
                title: ref.t('profile.myOrders'),
                subtitle: orders == null ? null : ref.t('profile.ordersCount', {'count': '${orders.length}'}),
                onTap: () => ref.read(mainTabProvider.notifier).state = 1,
              ),
              const ProfileRowDivider(indentForIcon: true),
              ProfileRow(
                icon: LucideIcons.heart,
                iconColor: const Color(0xFFE5484D),
                iconBackground: const Color(0xFFFDECEC),
                title: ref.t('favorites.title'),
                subtitle: favoriteCount == 0
                    ? ref.t('favorites.hint')
                    : ref.t('favorites.count', {'count': '$favoriteCount'}),
                onTap: () => context.push('/favorites'),
              ),
              const ProfileRowDivider(indentForIcon: true),
              ProfileRow(
                icon: LucideIcons.idCard,
                iconColor: const Color(0xFF7C3AED),
                iconBackground: const Color(0xFFF1EAFE),
                title: ref.t('profile.personalData'),
                subtitle: ref.t('profile.personalDataHint'),
                onTap: () => showEditProfileSheet(context, ref),
              ),
            ],
          ),
        ),
      AppSection(
        title: ref.t('profile.settingsSection'),
        padding: EdgeInsets.zero,
        child: ProfileRow(
          icon: LucideIcons.languages,
          iconColor: const Color(0xFF0E7490),
          iconBackground: const Color(0xFFE0F2F7),
          title: ref.t('profile.appLanguage'),
          subtitle: languageDisplayName(locale),
          onTap: () => _pickLanguage(context, ref),
        ),
      ),
      AppSection(
        title: ref.t('profile.helpSection'),
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            ProfileRow(
              icon: LucideIcons.lifeBuoy,
              iconColor: AppColors.accent,
              iconBackground: AppColors.accentLight,
              title: ref.t('profile.support'),
              onTap: () => _showSupport(context, ref),
            ),
            const ProfileRowDivider(indentForIcon: true),
            ProfileRow(
              icon: LucideIcons.info,
              iconColor: AppColors.info,
              iconBackground: AppColors.infoSoft,
              title: ref.t('profile.about'),
              subtitle: ref.t('profile.version', {'version': _kAppVersion}),
              onTap: () => _showAbout(context, ref),
            ),
          ],
        ),
      ),
      AppCard(
        padding: EdgeInsets.zero,
        child: ProfileRow(
          icon: LucideIcons.logOut,
          iconColor: AppColors.danger,
          iconBackground: AppColors.dangerSoft,
          title: ref.t('profile.logoutButton'),
          trailing: const SizedBox.shrink(),
          onTap: () => _logout(context, ref),
        ),
      ),
    ];
    // Gentle staggered entrance under the header.
    sections = [
      for (var i = 0; i < sections.length; i++)
        sections[i]
            .animate(delay: (80 + i * 50).ms)
            .fadeIn(duration: AppDurations.slow)
            .moveY(begin: 10, end: 0, curve: AppCurves.standard),
    ];

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.xl, AppSpacing.page, AppSpacing.xxxl),
              physics: const BouncingScrollPhysics(),
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: AppSpacing.xs, bottom: AppSpacing.lg),
                  child: Text(ref.t('profile.title'), style: AppText.h1),
                ),
                ProfileHeader(
                  name: name,
                  phone: user?.phone,
                  onEdit: user == null ? null : () => showEditProfileSheet(context, ref),
                  editTooltip: ref.t('profile.editProfile'),
                  stats: user == null ? null : const _OrderStats(),
                ),
                for (final section in sections) ...[
                  const SizedBox(height: AppSpacing.xxl),
                  section,
                ],
                const SizedBox(height: AppSpacing.xxl),
                Center(
                  child: Text(
                    '${ref.t('common.appName')} · ${ref.t('profile.version', {'version': _kAppVersion})}',
                    style: AppText.caption.copyWith(color: AppColors.textTertiary),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Orders placed, orders delivered and money spent on delivered orders.
/// Shows dashes while loading or when the history cannot be fetched.
class _OrderStats extends ConsumerWidget {
  const _OrderStats();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(myOrdersProvider).valueOrNull;
    final lang = ref.watch(localeProvider);
    final delivered = orders?.where((o) => o.status == OrderStatus.delivered).toList();
    final spent = delivered?.fold<int>(0, (sum, o) => sum + o.totalAmount);

    return Row(
      children: [
        Expanded(child: ProfileStat(label: ref.t('profile.statOrders'), value: orders?.length.toString())),
        const _StatDivider(),
        Expanded(child: ProfileStat(label: ref.t('profile.statDelivered'), value: delivered?.length.toString())),
        const _StatDivider(),
        Expanded(child: ProfileStat(label: ref.t('profile.statSpent'), value: spent == null ? null : formatPrice(spent, lang))),
      ],
    );
  }
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();

  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 32, color: AppColors.white.withValues(alpha: 0.16));
}
