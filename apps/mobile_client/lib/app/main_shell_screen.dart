import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/cart/presentation/cart_controller.dart';
import '../features/cart/presentation/cart_screen.dart';
import '../features/orders/presentation/orders_history_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/shops/presentation/home_screen.dart';
import '../ui/ui.dart';

/// Bottom-nav shell for the 4 top-level customer destinations per PDF Page 4:
/// Bosh | Buyurtmalar | Savat | Profil
class MainShellScreen extends ConsumerStatefulWidget {
  const MainShellScreen({super.key});

  @override
  ConsumerState<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends ConsumerState<MainShellScreen> {
  int _index = 0;

  // IndexedStack keeps every tab's scroll position and state alive.
  static const _screens = [
    HomeScreen(),
    OrdersHistoryScreen(),
    CartScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final cartCount = ref.watch(cartControllerProvider.select((c) => c.itemCount));

    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: _BottomBar(
        index: _index,
        onChanged: (i) => setState(() => _index = i),
        items: [
          const _TabItem(icon: LucideIcons.home, label: 'Bosh'),
          const _TabItem(icon: LucideIcons.clipboardList, label: 'Buyurtmalar'),
          _TabItem(
            icon: LucideIcons.shoppingBag,
            label: 'Savat',
            badge: cartCount > 0 ? '$cartCount' : null,
          ),
          const _TabItem(icon: LucideIcons.user, label: 'Profil'),
        ],
      ),
    );
  }
}

class _TabItem {
  const _TabItem({required this.icon, required this.label, this.badge});
  final IconData icon;
  final String label;
  final String? badge;
}

/// White bar with a top hairline; the selected icon sits on a soft green pill.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.index, required this.onChanged, required this.items});

  final int index;
  final ValueChanged<int> onChanged;
  final List<_TabItem> items;

  static const double height = 64;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Container(
      height: height + bottomInset,
      padding: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++)
            Expanded(
              child: _BottomBarItem(
                item: items[i],
                selected: i == index,
                onTap: () {
                  if (i != index) onChanged(i);
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _BottomBarItem extends StatelessWidget {
  const _BottomBarItem({required this.item, required this.selected, required this.onTap});

  final _TabItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.brand : AppColors.ink400;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: Pressable(
        onTap: onTap,
        haptic: true,
        scale: 0.94,
        child: SizedBox(
          height: _BottomBar.height,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  AnimatedContainer(
                    duration: AppDurations.normal,
                    curve: AppCurves.standard,
                    width: selected ? 56 : 40,
                    height: 30,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: selected ? AppColors.green100 : Colors.transparent,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Icon(item.icon, size: 22, color: color),
                  ),
                  if (item.badge != null)
                    Positioned(
                      right: selected ? 4 : -4,
                      top: -4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                          border: Border.all(color: AppColors.surface, width: 1.5),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          item.badge!,
                          style: AppText.micro.copyWith(color: AppColors.white).weight(700),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              AnimatedDefaultTextStyle(
                duration: AppDurations.normal,
                curve: AppCurves.standard,
                style: AppText.caption.copyWith(color: color).weight(selected ? 600 : 500),
                child: Text(item.label, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

