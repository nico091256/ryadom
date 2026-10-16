import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers.dart';
import '../features/orders/presentation/orders_history_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/shops/presentation/home_screen.dart';
import 'theme.dart';

/// Bottom-nav shell for the three top-level customer destinations. Screens
/// pushed on top (shop detail, cart, checkout, order tracking) go through
/// go_router as ordinary routes, above this shell.
class MainShellScreen extends ConsumerStatefulWidget {
  const MainShellScreen({super.key});

  @override
  ConsumerState<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends ConsumerState<MainShellScreen> {
  int _index = 0;

  static const _screens = [HomeScreen(), OrdersHistoryScreen(), ProfileScreen()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        indicatorColor: AppTheme.seed.withValues(alpha: 0.15),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home, color: AppTheme.seed), label: ref.t('tabs.home')),
          NavigationDestination(icon: const Icon(Icons.receipt_long_outlined), selectedIcon: const Icon(Icons.receipt_long, color: AppTheme.seed), label: ref.t('tabs.orders')),
          NavigationDestination(icon: const Icon(Icons.person_outline), selectedIcon: const Icon(Icons.person, color: AppTheme.seed), label: ref.t('tabs.profile')),
        ],
      ),
    );
  }
}
