import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_client/core/i18n/i18n_service.dart';
import 'package:mobile_client/core/providers.dart';
import 'package:mobile_client/features/shops/domain/shop.dart';
import 'package:mobile_client/features/shops/presentation/home_controller.dart';
import 'package:mobile_client/features/shops/presentation/home_screen.dart';
import 'package:mobile_client/features/shops/presentation/shop_detail_controller.dart';
import 'package:mobile_client/features/shops/presentation/shop_detail_screen.dart';
import 'package:mobile_client/features/shops/presentation/widgets/shop_card.dart';
import 'package:mobile_client/ui/transitions.dart';

/// Regression test for the "photos go dark after coming back from a shop" bug:
/// a Hero on the shop cover was aborted when the Home list rebuilt, which left
/// the card's cover widget hidden. Home → shop → back must leave every card
/// with its cover in place.
Shop _shop(String id, String name) => Shop(
      id: id,
      name: name,
      logoUrl: null,
      phone: '+998900000000',
      addressText: 'Test address',
      lat: 41.3,
      lng: 69.24,
      openTime: '08:00',
      closeTime: '22:00',
      isOpen: true,
      isCurrentlyOpen: true,
      distanceMeters: 500,
      productCount: 3,
    );

void main() {
  late I18nService i18n;

  setUp(() async {
    i18n = I18nService();
    await i18n.load();
  });

  testWidgets('Home → shop detail → back keeps every shop card cover', (tester) async {
    tester.view.physicalSize = const Size(390, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final shops = [_shop('s1', 'Chilonzor Market'), _shop('s2', 'Yunusobod Bazaar')];
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(path: '/home', pageBuilder: (context, state) => fadeSlidePage(key: state.pageKey, child: const HomeScreen())),
        GoRoute(
          path: '/shop/:id',
          pageBuilder: (context, state) =>
              slidePage(key: state.pageKey, child: ShopDetailScreen(shopId: state.pathParameters['id']!)),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          i18nServiceProvider.overrideWithValue(i18n),
          nearbyShopsProvider.overrideWith((ref) async => shops),
          homeCategoriesProvider.overrideWith((ref) async => const []),
          locationPromptEnabledProvider.overrideWithValue(false),
          shopDetailProvider.overrideWith((ref, id) async => shops.firstWhere((s) => s.id == id)),
          shopProductsProvider.overrideWith((ref, id) async => const []),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(ShopCard), findsNWidgets(2));
    expect(find.byType(ShopCover), findsNWidgets(2));

    // Open the first shop.
    await tester.tap(find.text('Chilonzor Market'));
    await tester.pumpAndSettle();
    expect(find.byType(ShopDetailScreen), findsOneWidget);
    expect(find.text('Chilonzor Market'), findsAtLeastNWidgets(1));
    expect(find.byType(HomeScreen), findsNothing);

    // Simulate the list refreshing while the detail page is open (the trigger
    // of the original bug), then go back.
    final container = ProviderScope.containerOf(tester.element(find.byType(ShopDetailScreen)));
    container.invalidate(nearbyShopsProvider);
    router.pop();
    await tester.pumpAndSettle();

    expect(find.byType(ShopDetailScreen), findsNothing);
    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(ShopCard), findsNWidgets(2));
    // Every card still paints its cover (no orphaned Hero placeholder).
    expect(find.byType(ShopCover), findsNWidgets(2));
    for (final cover in tester.widgetList<ShopCover>(find.byType(ShopCover))) {
      expect(tester.getSize(find.byWidget(cover)).height, greaterThan(0));
    }
    expect(find.text('Chilonzor Market'), findsOneWidget);
    expect(find.text('Yunusobod Bazaar'), findsOneWidget);
  });
}
