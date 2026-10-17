import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers.dart';
import '../../../ui/ui.dart';
import '../../location/domain/selected_address.dart';
import '../../location/presentation/address_controller.dart';
import '../../location/presentation/address_picker_sheet.dart';
import '../../location/presentation/location_permission_modal.dart';
import '../domain/shop.dart';
import 'home_controller.dart';
import 'widgets/category_row.dart';
import 'widgets/home_header.dart';
import 'widgets/recent_order_card.dart';
import 'widgets/shop_card.dart';
import 'widgets/shops_map_view.dart';

/// Content is capped at this width on tablets/desktop web.
const double _maxContentWidth = 560;

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  static const _locationPromptedKey = 'ryadom_location_prompted';

  bool _mapMode = false;
  late final TextEditingController _search = TextEditingController(text: ref.read(shopSearchQueryProvider));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybePromptForLocation());
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  /// First launch only: while the address is still the city-centre default,
  /// ask once whether to use GPS or type the address (design PDF p.10).
  Future<void> _maybePromptForLocation() async {
    if (!mounted || !ref.read(locationPromptEnabledProvider)) return;
    if (ref.read(addressControllerProvider) != SelectedAddress.tashkentDefault) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool(_locationPromptedKey) ?? false) return;
      await prefs.setBool(_locationPromptedKey, true);
    } catch (_) {
      return; // No persistent storage (tests, private mode) → never nag.
    }
    if (!mounted) return;
    await showLocationPermissionSheet(
      context,
      onManualSelected: _openAddressSheet,
      onLocationGranted: () => ref.invalidate(nearbyShopsProvider),
    );
  }

  void _toggleMap() => setState(() => _mapMode = !_mapMode);

  void _openAddressSheet() {
    showAddressPickerSheet(context, ref, onApplied: () => ref.invalidate(nearbyShopsProvider));
  }

  @override
  Widget build(BuildContext context) {
    final shopsAsync = ref.watch(filteredShopsProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxContentWidth),
            child: AnimatedSwitcher(
              duration: AppDurations.normal,
              switchInCurve: AppCurves.standard,
              switchOutCurve: Curves.easeIn,
              child: _mapMode
                  ? ShopsMapView(
                      key: const ValueKey('map'),
                      shops: shopsAsync.valueOrNull ?? const [],
                      address: ref.watch(addressControllerProvider),
                      onShowList: _toggleMap,
                      onAddressTap: _openAddressSheet,
                    )
                  : _ShopList(
                      key: const ValueKey('list'),
                      shopsAsync: shopsAsync,
                      searchController: _search,
                      onToggleMap: _toggleMap,
                      onAddressTap: _openAddressSheet,
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ShopList extends ConsumerStatefulWidget {
  const _ShopList({
    super.key,
    required this.shopsAsync,
    required this.searchController,
    required this.onToggleMap,
    required this.onAddressTap,
  });

  final AsyncValue<List<Shop>> shopsAsync;
  final TextEditingController searchController;
  final VoidCallback onToggleMap;
  final VoidCallback onAddressTap;

  @override
  ConsumerState<_ShopList> createState() => _ShopListState();
}

class _ShopListState extends ConsumerState<_ShopList> {
  static const _staggerStep = 40;
  static const _maxStaggered = 8;

  /// Shops that took part in the entrance stagger (id → delay index). Only
  /// the first data frame is animated; later rebuilds and lazily built rows
  /// render instantly.
  final Map<String, int> _staggered = {};
  bool _entranceDone = false;

  Widget _buildCard(BuildContext context, Shop shop, int index) {
    final card = ShopCard(shop: shop, onTap: () => context.push('/shop/${shop.id}'));
    var slot = _staggered[shop.id];
    if (slot == null && !_entranceDone) {
      slot = _staggered[shop.id] = math.min(index, _maxStaggered);
    }
    if (slot == null) return KeyedSubtree(key: ValueKey(shop.id), child: card);
    return card
        .animate(key: ValueKey(shop.id), delay: (slot * _staggerStep).ms)
        .fadeIn(duration: AppDurations.slow, curve: AppCurves.standard)
        .moveY(begin: 12, end: 0, duration: AppDurations.slow, curve: AppCurves.standard);
  }

  @override
  Widget build(BuildContext context) {
    final shopsAsync = widget.shopsAsync;
    final shops = shopsAsync.valueOrNull;
    if (shops != null && shops.isNotEmpty && !_entranceDone) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _entranceDone = true);
    }

    return RefreshIndicator(
      color: AppColors.brand,
      onRefresh: () async => ref.invalidate(nearbyShopsProvider),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        slivers: [
          SliverToBoxAdapter(
            child: HomeHeader(mapMode: false, onToggleMap: widget.onToggleMap, onAddressTap: widget.onAddressTap),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.page, AppSpacing.lg, AppSpacing.page, AppSpacing.xl),
              child: AppSearchBar(
                controller: widget.searchController,
                hint: ref.t('home.searchPlaceholder'),
                onChanged: (v) => ref.read(shopSearchQueryProvider.notifier).state = v,
              ),
            ),
          ),
          const SliverToBoxAdapter(child: CategoryRow()),
          const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),
          SliverToBoxAdapter(
            child: SectionHeader(
              title: ref.t('home.nearbyShops'),
              count: shops?.length,
              actionLabel: ref.t('home.mapView'),
              onAction: widget.onToggleMap,
            ),
          ),
          shopsAsync.when(
            data: (shops) => shops.isEmpty
                ? SliverFillRemaining(
                    hasScrollBody: false,
                    child: EmptyState(
                      illustration: AppIllustration.noShops,
                      title: ref.t('home.noShopsNearby'),
                      subtitle: ref.t('home.noShopsHint'),
                      actionLabel: ref.t('home.changeAddress'),
                      onAction: widget.onAddressTap,
                    ),
                  )
                : SliverList.separated(
                    itemCount: shops.length,
                    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
                    itemBuilder: (context, i) => Padding(
                      padding: AppSpacing.pagePadding,
                      child: _buildCard(context, shops[i], i),
                    ),
                  ),
            loading: () => SliverList.separated(
              itemCount: 3,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (_, _) => const Padding(padding: AppSpacing.pagePadding, child: ShopCardSkeleton()),
            ),
            error: (_, _) => SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(
                illustration: AppIllustration.offline,
                title: ref.t('common.error'),
                subtitle: ref.t('home.loadFailed'),
                actionLabel: ref.t('common.retry'),
                onAction: () => ref.invalidate(nearbyShopsProvider),
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: RecentOrderCard(),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),
        ],
      ),
    );
  }
}
