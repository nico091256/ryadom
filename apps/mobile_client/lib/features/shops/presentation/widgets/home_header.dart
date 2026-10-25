import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../location/presentation/address_controller.dart';

/// Top section of Home per user spec:
/// Level 1 (Hero):
///   - Compact delivery address strip ("Yetkazish manzili: Qorasuv 4, 12-uy ▾") + Map Toggle
///   - Large hero headline (28-30px Manrope 800): "Nima buyurtma qilamiz, Sardor?"
///   - Rich Hero Banner: "Issiq non — 10 daqiqada" with gradient and callout
class HomeHeader extends ConsumerWidget {
  const HomeHeader({
    super.key,
    required this.mapMode,
    required this.onToggleMap,
    required this.onAddressTap,
  });

  final bool mapMode;
  final VoidCallback onToggleMap;
  final VoidCallback onAddressTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final address = ref.watch(addressControllerProvider.select((a) => a.addressText));
    final user = ref.watch(authControllerProvider).valueOrNull;
    final userName = user?.name != null && user!.name!.trim().isNotEmpty
        ? user.name!.trim().split(' ').first
        : null;

    final headline = userName != null ? ref.t('home.greeting', {'name': userName}) : ref.t('home.greetingAnon');

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.md, AppSpacing.page, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Top Bar: Delivery Address selector + Map toggle
          Row(
            children: [
              Expanded(
                child: Pressable(
                  onTap: onAddressTap,
                  haptic: true,
                  scale: 0.98,
                  child: Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      border: Border.all(color: AppColors.border, width: 1.0),
                      boxShadow: AppShadows.xs,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: const BoxDecoration(
                            color: AppColors.accentLight,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: const Icon(LucideIcons.mapPin, size: 14, color: AppColors.accent),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            address.isNotEmpty ? address : ref.t('home.addressEmpty'),
                            style: AppText.captionStrong.copyWith(color: AppColors.textPrimary, letterSpacing: -0.2),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(LucideIcons.chevronDown, size: 15, color: AppColors.textSecondary),
                        const SizedBox(width: 2),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              MapToggleButton(
                mapMode: mapMode,
                onPressed: onToggleMap,
                tooltip: ref.t(mapMode ? 'home.listView' : 'home.mapView'),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.lg),

          // 2. Time-of-day greeting over the large headline.
          Row(
            children: [
              Icon(_greetingIcon(), size: 16, color: AppColors.accent),
              const SizedBox(width: 6),
              Text(ref.t(_greetingKey()), style: AppText.bodySm.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            headline,
            style: AppText.sarlavhaL.copyWith(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              color: AppColors.textPrimary,
              height: 1.15,
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // 3. Hero Banner: "Issiq non — 10 daqiqada"
          const _HomeHeroBanner(),
        ],
      ),
    );
  }
}

String _greetingKey([DateTime? now]) {
  final h = (now ?? DateTime.now()).hour;
  if (h >= 5 && h < 12) return 'home.goodMorning';
  if (h >= 12 && h < 18) return 'home.goodAfternoon';
  return 'home.goodEvening';
}

IconData _greetingIcon([DateTime? now]) {
  final h = (now ?? DateTime.now()).hour;
  if (h >= 5 && h < 12) return LucideIcons.sunrise;
  if (h >= 12 && h < 18) return LucideIcons.sun;
  return LucideIcons.moon;
}

/// Whether the Home promo carousel advances on its own. Widget tests turn it
/// off so no periodic timer outlives the test.
final homePromoAutoplayProvider = Provider<bool>((ref) => true);

class _Promo {
  const _Promo({required this.scene, required this.icon, required this.key, required this.colors});
  final IntroScene scene;
  final IconData icon;
  final String key; // i18n prefix: <key>Chip / <key>Title / <key>Subtitle
  final List<Color> colors;
}

const _promos = [
  _Promo(
    scene: IntroScene.delivery,
    icon: LucideIcons.zap,
    key: 'home.hero',
    colors: [Color(0xFF178765), Color(0xFF0F5C45), Color(0xFF0A3E2F)],
  ),
  _Promo(
    scene: IntroScene.bag,
    icon: LucideIcons.gift,
    key: 'home.promoFree',
    colors: [Color(0xFFE0621B), Color(0xFFC2410C), Color(0xFF8A2E0A)],
  ),
  _Promo(
    scene: IntroScene.shop,
    icon: LucideIcons.store,
    key: 'home.promoLocal',
    colors: [Color(0xFF1E6B8F), Color(0xFF15516E), Color(0xFF0D3448)],
  ),
];

/// Hero carousel — the visual anchor of Home: three promo cards drawn with
/// the app's own scene art (ships with the build, no runtime photo fetch),
/// auto-advancing every few seconds, swipeable, with page dots.
class _HomeHeroBanner extends ConsumerStatefulWidget {
  const _HomeHeroBanner();

  @override
  ConsumerState<_HomeHeroBanner> createState() => _HomeHeroBannerState();
}

class _HomeHeroBannerState extends ConsumerState<_HomeHeroBanner> {
  static const _interval = Duration(milliseconds: 4500);

  final PageController _page = PageController();
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    if (ref.read(homePromoAutoplayProvider)) _restartTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _page.dispose();
    super.dispose();
  }

  /// Restarted after every manual swipe so the user gets a full interval.
  void _restartTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) {
      if (!mounted || !_page.hasClients) return;
      _page.animateToPage((_index + 1) % _promos.length, duration: AppDurations.page * 2, curve: AppCurves.emphasized);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 168,
          child: NotificationListener<ScrollStartNotification>(
            onNotification: (n) {
              if (n.dragDetails != null && _timer != null) _restartTimer();
              return false;
            },
            child: PageView.builder(
              controller: _page,
              itemCount: _promos.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) => AnimatedBuilder(
                animation: _page,
                // Parallax: the art drifts slower than the card while swiping.
                builder: (context, child) {
                  final page = _page.hasClients && _page.position.haveDimensions ? _page.page ?? 0 : _index.toDouble();
                  return _PromoCard(promo: _promos[i], parallax: (i - page).clamp(-1.0, 1.0));
                },
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < _promos.length; i++)
              AnimatedContainer(
                duration: AppDurations.normal,
                curve: AppCurves.standard,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _index ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i == _index ? AppColors.brand : AppColors.ink300,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _PromoCard extends ConsumerWidget {
  const _PromoCard({required this.promo, required this.parallax});

  final _Promo promo;

  /// -1..1: how far this card is from the centre of the carousel.
  final double parallax;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: promo.colors),
        borderRadius: BorderRadius.circular(AppRadius.rCard),
        boxShadow: [BoxShadow(color: promo.colors[1].withValues(alpha: 0.28), blurRadius: 22, offset: const Offset(0, 8))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Soft light blooms.
          Positioned(
            right: -30,
            top: -40,
            child: Container(
              width: 190,
              height: 190,
              decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.white.withValues(alpha: 0.08)),
            ),
          ),
          Positioned(
            left: -40,
            bottom: -70,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.white.withValues(alpha: 0.05)),
            ),
          ),
          Positioned(
            right: -6 + parallax * 60,
            top: 0,
            bottom: 0,
            child: Center(child: IntroSceneArt(promo.scene, size: 156)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.xl, AppSpacing.lg, 150, AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    border: Border.all(color: AppColors.white.withValues(alpha: 0.3), width: 0.8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(promo.icon, size: 12, color: const Color(0xFFFFD27A)),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          ref.t('${promo.key}Chip'),
                          style: AppText.micro.copyWith(color: AppColors.white, fontWeight: FontWeight.w700),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                _buildPromoTitle(ref.t('${promo.key}Title')),
                const SizedBox(height: 4),
                Text(
                  ref.t('${promo.key}Subtitle'),
                  style: AppText.caption.copyWith(color: AppColors.white.withValues(alpha: 0.9), height: 1.25),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPromoTitle(String text) {
    if (text.contains('*')) {
      final parts = text.split('*');
      return Text.rich(
        TextSpan(
          style: AppText.sarlavhaM.copyWith(color: AppColors.white, letterSpacing: -0.4, height: 1.15),
          children: [
            for (var i = 0; i < parts.length; i++)
              if (i.isOdd)
                TextSpan(
                  text: parts[i],
                  style: AppText.editorialUrguCustom(size: 20, color: const Color(0xFFFFD27A)),
                )
              else
                TextSpan(text: parts[i]),
          ],
        ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      );
    }
    return Text(
      text,
      style: AppText.sarlavhaM.copyWith(color: AppColors.white, letterSpacing: -0.4, height: 1.15),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// Address pill used over map mode
class AddressPill extends StatelessWidget {
  const AddressPill({
    super.key,
    required this.label,
    required this.address,
    required this.onTap,
    this.elevated = false,
    this.emptyLabel = '—',
  });

  final String label;
  final String address;
  final VoidCallback onTap;
  final bool elevated;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      haptic: true,
      elevated: elevated,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(color: AppColors.accentLight, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: const Icon(LucideIcons.mapPin, size: 20, color: AppColors.accent),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label, style: AppText.izoh, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(address.isEmpty ? emptyLabel : address, style: AppText.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          const Icon(LucideIcons.pencil, size: 18, color: AppColors.textSecondary),
        ],
      ),
    );
  }
}

/// 44-50px square toggle; inverts to ink when the map is showing.
class MapToggleButton extends StatelessWidget {
  const MapToggleButton({
    super.key,
    required this.mapMode,
    required this.onPressed,
    this.tooltip,
    this.shadow = false,
  });

  final bool mapMode;
  final VoidCallback onPressed;
  final String? tooltip;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    return AppIconButton(
      icon: mapMode ? LucideIcons.list : LucideIcons.map,
      size: 44,
      iconSize: 20,
      onPressed: onPressed,
      tooltip: tooltip,
      shadow: shadow,
      bordered: !shadow,
      background: mapMode ? AppColors.brand : AppColors.surface,
      foreground: mapMode ? AppColors.white : AppColors.textPrimary,
    );
  }
}
