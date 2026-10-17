import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart' show LatLng;
import 'package:localshop_shared/localshop_shared.dart';

import '../../../../core/providers.dart';
import '../../../../ui/ui.dart';
import '../../../location/domain/selected_address.dart';
import '../../../location/presentation/app_map_tiles.dart';
import '../../domain/shop.dart';
import 'home_header.dart';
import 'shop_card.dart';

const double _radiusMeters = 3000;
const double _homeZoom = 14;
const double _shopZoom = 15;

/// Map mode of Home: 3 km radius around the customer, a pulsing "you" dot,
/// one logo pin per shop, a swipeable carousel and a preview card for the
/// selected shop. Built only while map mode is active so no tiles load behind
/// the list.
class ShopsMapView extends ConsumerStatefulWidget {
  const ShopsMapView({
    super.key,
    required this.shops,
    required this.address,
    required this.onShowList,
    required this.onAddressTap,
  });

  final List<Shop> shops;
  final SelectedAddress address;
  final VoidCallback onShowList;
  final VoidCallback onAddressTap;

  @override
  ConsumerState<ShopsMapView> createState() => _ShopsMapViewState();
}

class _ShopsMapViewState extends ConsumerState<ShopsMapView> with SingleTickerProviderStateMixin {
  final MapController _map = MapController();
  late final AnimationController _fly = AnimationController(vsync: this, duration: AppDurations.slow);
  late final CurvedAnimation _flyCurve = CurvedAnimation(parent: _fly, curve: AppCurves.emphasized);
  final PageController _page = PageController(viewportFraction: 0.84);

  LatLng? _flyFrom;
  LatLng? _flyTo;
  double _zoomFrom = _homeZoom;
  double _zoomTo = _homeZoom;

  bool _mapReady = false;
  String? _selectedId;
  Shop? _previewShop;

  LatLng get _home => LatLng(widget.address.lat, widget.address.lng);

  @override
  void initState() {
    super.initState();
    _fly.addListener(_onFlyTick);
  }

  @override
  void didUpdateWidget(covariant ShopsMapView old) {
    super.didUpdateWidget(old);
    if (old.address.lat != widget.address.lat || old.address.lng != widget.address.lng) {
      _animateTo(_home, zoom: _homeZoom);
    }
    if (_selectedId != null && !widget.shops.any((s) => s.id == _selectedId)) {
      _selectedId = null;
    }
  }

  @override
  void dispose() {
    _fly.removeListener(_onFlyTick);
    _flyCurve.dispose();
    _fly.dispose();
    _page.dispose();
    _map.dispose();
    super.dispose();
  }

  void _onFlyTick() {
    final from = _flyFrom;
    final to = _flyTo;
    if (from == null || to == null) return;
    final t = _flyCurve.value;
    _map.move(
      LatLng(from.latitude + (to.latitude - from.latitude) * t, from.longitude + (to.longitude - from.longitude) * t),
      _zoomFrom + (_zoomTo - _zoomFrom) * t,
    );
  }

  void _animateTo(LatLng target, {double? zoom}) {
    if (!_mapReady) return;
    if (_fly.isAnimating && _flyTo == target) return;
    final camera = _map.camera;
    _flyFrom = camera.center;
    _flyTo = target;
    _zoomFrom = camera.zoom;
    _zoomTo = zoom ?? math.max(camera.zoom, _shopZoom);
    _fly.forward(from: 0);
  }

  void _select(Shop shop, {bool fromCarousel = false}) {
    if (_selectedId != shop.id) {
      setState(() {
        _selectedId = shop.id;
        _previewShop = shop;
      });
    }
    _animateTo(LatLng(shop.lat, shop.lng));
    if (fromCarousel || !_page.hasClients) return;
    final index = widget.shops.indexWhere((s) => s.id == shop.id);
    if (index >= 0 && (_page.page?.round() ?? -1) != index) {
      _page.animateToPage(index, duration: AppDurations.slow, curve: AppCurves.standard);
    }
  }

  void _onPositionChanged(MapCamera camera, bool hasGesture) {
    if (hasGesture && _selectedId != null) setState(() => _selectedId = null);
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(localeProvider);
    final shops = widget.shops;
    final selected = _selectedId;
    final preview = selected == null ? null : _previewShop;

    return Stack(
      children: [
        Positioned.fill(
          child: RepaintBoundary(
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: _home,
                initialZoom: _homeZoom,
                backgroundColor: AppColors.ink100,
                onMapReady: () => _mapReady = true,
                onPositionChanged: _onPositionChanged,
              ),
              children: [
                appTileLayer(context),
                CircleLayer(
                  circles: [
                    CircleMarker(
                      point: _home,
                      radius: _radiusMeters,
                      useRadiusInMeter: true,
                      color: AppColors.brand.withValues(alpha: 0.08),
                      borderColor: AppColors.brand.withValues(alpha: 0.35),
                      borderStrokeWidth: 1.5,
                    ),
                  ],
                ),
                MarkerLayer(
                  markers: [
                    for (final shop in shops)
                      Marker(
                        key: ValueKey('pin-${shop.id}'),
                        point: LatLng(shop.lat, shop.lng),
                        width: 56,
                        height: 60,
                        alignment: Alignment.topCenter,
                        child: ShopPin(shop: shop, selected: shop.id == selected, onTap: () => _select(shop)),
                      ),
                    Marker(point: _home, width: 56, height: 56, child: const PulsingDot()),
                  ],
                ),
              ],
            ),
          ),
        ),
        Positioned(
          top: AppSpacing.md,
          left: AppSpacing.page,
          right: AppSpacing.page,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AddressPill(
                  label: ref.t('home.deliverTo'),
                  address: widget.address.addressText,
                  onTap: widget.onAddressTap,
                  elevated: true,
                ),
              ),
              const SizedBox(width: AppSpacing.sm + AppSpacing.xxs),
              Column(
                children: [
                  MapToggleButton(mapMode: true, onPressed: widget.onShowList, tooltip: ref.t('home.listView'), shadow: true),
                  const SizedBox(height: AppSpacing.sm),
                  AppIconButton(
                    icon: LucideIcons.locateFixed,
                    size: 56,
                    iconSize: 22,
                    shadow: true,
                    bordered: false,
                    foreground: AppColors.brand,
                    tooltip: ref.t('home.myLocation'),
                    onPressed: () => _animateTo(_home, zoom: _homeZoom),
                  ),
                ],
              ),
            ],
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(padding: EdgeInsets.only(left: AppSpacing.page), child: MapAttribution()),
              const SizedBox(height: AppSpacing.sm),
              if (shops.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.page),
                  child: AppCard(
                    elevated: true,
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
                    child: Row(
                      children: [
                        const Icon(LucideIcons.store, size: 18, color: AppColors.ink400),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(child: Text(ref.t('home.noShopsNearby'), style: AppText.bodyMedium.secondary)),
                      ],
                    ),
                  ),
                )
              else
                SizedBox(
                  height: 68,
                  child: PageView.builder(
                    controller: _page,
                    itemCount: shops.length,
                    onPageChanged: (i) => _select(shops[i], fromCarousel: true),
                    itemBuilder: (_, i) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.xxs),
                      child: ShopMiniCard(
                        shop: shops[i],
                        selected: shops[i].id == selected,
                        lang: lang,
                        openLabel: ref.t(shops[i].isCurrentlyOpen ? 'home.open' : 'home.closed'),
                        onTap: () => _select(shops[i]),
                      ),
                    ),
                  ),
                ),
              AnimatedSize(
                duration: AppDurations.slow,
                curve: AppCurves.emphasized,
                alignment: Alignment.topCenter,
                child: AnimatedSwitcher(
                  duration: AppDurations.normal,
                  switchInCurve: AppCurves.standard,
                  switchOutCurve: Curves.easeIn,
                  transitionBuilder: (child, animation) => FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero).animate(animation),
                      child: child,
                    ),
                  ),
                  child: preview == null
                      ? const SizedBox(key: ValueKey('no-preview'), width: double.infinity, height: AppSpacing.lg)
                      : Padding(
                          key: ValueKey('preview-${preview.id}'),
                          padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.md, AppSpacing.page, AppSpacing.lg),
                          child: ShopPreviewCard(
                            shop: preview,
                            lang: lang,
                            openLabel: ref.t(preview.isCurrentlyOpen ? 'home.open' : 'home.closed'),
                            ctaLabel: ref.t('home.goToShop'),
                            onOpen: () => context.push('/shop/${preview.id}'),
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 44px rounded white pin with the shop logo and a small tail; green border
/// when open, grey when closed; grows to 1.15 when selected.
class ShopPin extends StatelessWidget {
  const ShopPin({super.key, required this.shop, required this.selected, required this.onTap});

  final Shop shop;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final border = shop.isCurrentlyOpen ? AppColors.brand : AppColors.ink300;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: AnimatedScale(
        scale: selected ? 1.15 : 1,
        alignment: Alignment.bottomCenter,
        duration: AppDurations.normal,
        curve: AppCurves.standard,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Container(
              width: 44,
              height: 44,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: border, width: 2),
                boxShadow: selected ? AppShadows.md : AppShadows.sm,
              ),
              child: AppAvatar(url: shop.logoUrl, name: shop.name, size: 34),
            ),
            CustomPaint(size: const Size(12, 7), painter: _PinTailPainter(border)),
          ],
        ),
      ),
    );
  }
}

class _PinTailPainter extends CustomPainter {
  const _PinTailPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_PinTailPainter old) => old.color != color;
}

/// Customer location: solid brand dot with an expanding, fading halo.
class PulsingDot extends StatefulWidget {
  const PulsingDot({super.key});

  @override
  State<PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<PulsingDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, _) {
          final t = Curves.easeOut.transform(_c.value);
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 18 + 38 * t,
                height: 18 + 38 * t,
                decoration: BoxDecoration(color: AppColors.brand.withValues(alpha: 0.35 * (1 - t)), shape: BoxShape.circle),
              ),
              Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: AppColors.brand,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.white, width: 3),
                  boxShadow: AppShadows.sm,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Compact carousel card above the preview.
class ShopMiniCard extends StatelessWidget {
  const ShopMiniCard({
    super.key,
    required this.shop,
    required this.selected,
    required this.lang,
    required this.openLabel,
    required this.onTap,
  });

  final Shop shop;
  final bool selected;
  final SupportedLanguage lang;
  final String openLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: AppRadius.card, boxShadow: AppShadows.md),
      child: AppCard(
        onTap: onTap,
        haptic: true,
        padding: const EdgeInsets.all(AppSpacing.sm + AppSpacing.xxs),
        borderColor: selected ? AppColors.brand : AppColors.white,
        child: Row(
          children: [
            AppAvatar(url: shop.logoUrl, name: shop.name, size: 40),
            const SizedBox(width: AppSpacing.sm + AppSpacing.xxs),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(shop.name, style: AppText.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    '${formatDistance(shop.distanceMeters, lang)} · ${shop.openTime}–${shop.closeTime}',
                    style: AppText.caption,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            ShopOpenBadge(open: shop.isCurrentlyOpen, label: openLabel, size: 11),
          ],
        ),
      ),
    );
  }
}

/// Bottom preview for the selected pin with the "Do'konga o'tish" CTA.
class ShopPreviewCard extends StatelessWidget {
  const ShopPreviewCard({
    super.key,
    required this.shop,
    required this.lang,
    required this.openLabel,
    required this.ctaLabel,
    required this.onOpen,
  });

  final Shop shop;
  final SupportedLanguage lang;
  final String openLabel;
  final String ctaLabel;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      elevated: true,
      borderColor: AppColors.brand,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.brand,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                alignment: Alignment.center,
                child: const Icon(LucideIcons.store, size: 24, color: AppColors.white),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(shop.name, style: AppText.title.copyWith(fontSize: 16), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 3),
                    Text(
                      '${formatDistance(shop.distanceMeters, lang)} · taxminan 10 daqiqa',
                      style: AppText.izoh.copyWith(color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                shop.isCurrentlyOpen ? 'Ochiq' : 'Yopiq',
                style: AppText.bodyStrong.copyWith(
                  color: shop.isCurrentlyOpen ? AppColors.brand : AppColors.danger,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Do\'konni tanlash',
            size: AppButtonSize.lg,
            onPressed: onOpen,
          ),
        ],
      ),
    );
  }
}
