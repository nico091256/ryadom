import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers.dart';
import '../features/orders/presentation/orders_board_screen.dart';
import '../features/shop/presentation/products_list_screen.dart';
import '../features/shop/presentation/shop_settings_screen.dart';
import '../features/shop/presentation/stats_screen.dart';
import 'theme.dart';

/// Bottom-nav shell for the shopkeeper's four top-level destinations.
class MainShellScreen extends ConsumerStatefulWidget {
  const MainShellScreen({super.key});

  @override
  ConsumerState<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends ConsumerState<MainShellScreen> {
  int _index = 0;

  static const _screens = [OrdersBoardScreen(), ProductsListScreen(), ShopSettingsScreen(), StatsScreen()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        indicatorColor: AppTheme.seed.withValues(alpha: 0.15),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.receipt_long_outlined), selectedIcon: const Icon(Icons.receipt_long, color: AppTheme.seed), label: ref.t('tabs.orders')),
          NavigationDestination(icon: const Icon(Icons.inventory_2_outlined), selectedIcon: const Icon(Icons.inventory_2, color: AppTheme.seed), label: ref.t('tabs.products')),
          NavigationDestination(icon: const Icon(Icons.storefront_outlined), selectedIcon: const Icon(Icons.storefront, color: AppTheme.seed), label: ref.t('tabs.shop')),
          NavigationDestination(icon: const Icon(Icons.bar_chart_outlined), selectedIcon: const Icon(Icons.bar_chart, color: AppTheme.seed), label: ref.t('tabs.stats')),
        ],
      ),
    );
  }
}
