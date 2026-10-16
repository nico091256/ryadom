import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:localshop_shared/localshop_shared.dart';
import '../../../app/theme.dart';
import '../../../core/providers.dart';
import '../../location/domain/selected_address.dart';
import '../../location/presentation/address_controller.dart';
import '../domain/shop.dart';
import 'home_controller.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final address = ref.watch(addressControllerProvider);
    final shopsAsync = ref.watch(filteredShopsProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(nearbyShopsProvider),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _Header(address: address)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                  child: TextField(
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: ref.t('home.searchPlaceholder'),
                    ),
                    onChanged: (v) => ref.read(shopSearchQueryProvider.notifier).state = v,
                  ),
                ),
              ),
              shopsAsync.when(
                data: (shops) => shops.isEmpty
                    ? SliverFillRemaining(hasScrollBody: false, child: _EmptyState(text: ref.t('home.noShopsNearby')))
                    : SliverList.separated(
                        itemCount: shops.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) => Padding(
                          padding: EdgeInsets.fromLTRB(16, i == 0 ? 4 : 0, 16, 0),
                          child: _ShopCard(shop: shops[i]),
                        ),
                      ),
                loading: () => const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator())),
                error: (err, _) => SliverFillRemaining(hasScrollBody: false, child: _EmptyState(text: '$err', isError: true)),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends ConsumerWidget {
  const _Header({required this.address});
  final SelectedAddress address;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          const Icon(Icons.location_on, color: AppTheme.seed, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ref.t('home.deliverTo'), style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                Text(
                  address.addressText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => _detectLocation(context, ref),
            child: Text(ref.t('home.changeAddress')),
          ),
        ],
      ),
    );
  }

  Future<void> _detectLocation(BuildContext context, WidgetRef ref) async {
    final lang = ref.read(localeProvider).value;
    try {
      await ref.read(addressControllerProvider.notifier).detectCurrentLocation(lang: lang);
    } on LocationException catch (e) {
      if (!context.mounted) return;
      final key = switch (e.reason) {
        LocationFailureReason.permissionDenied || LocationFailureReason.permissionDeniedForever => 'home.locationPermissionDenied',
        LocationFailureReason.serviceDisabled => 'home.locationServiceDisabled',
        LocationFailureReason.unknown => 'home.locationUnknownError',
      };
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ref.t(key))));
    }
  }
}

class _ShopCard extends ConsumerWidget {
  const _ShopCard({required this.shop});
  final Shop shop;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(localeProvider);
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => context.push('/shop/${shop.id}'),
      child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 56,
              height: 56,
              child: shop.logoUrl != null
                  ? CachedNetworkImage(imageUrl: shop.logoUrl!, fit: BoxFit.cover)
                  : Container(color: const Color(0xFFF1F5F9), child: const Icon(Icons.storefront, color: Color(0xFF94A3B8))),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(shop.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(shop.addressText, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 6),
                Row(
                  children: [
                    _StatusBadge(isOpen: shop.isCurrentlyOpen, label: ref.t(shop.isCurrentlyOpen ? 'home.open' : 'home.closed')),
                    const SizedBox(width: 8),
                    Text(formatDistance(shop.distanceMeters, lang), style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.isOpen, required this.label});
  final bool isOpen;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = isOpen ? AppTheme.seed : const Color(0xFFD97706);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.text, this.isError = false});
  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(isError ? Icons.error_outline : Icons.storefront_outlined, size: 40, color: const Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }
}
