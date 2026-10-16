import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_client/core/i18n/i18n_service.dart';
import 'package:mobile_client/core/providers.dart';
import 'package:mobile_client/features/shops/domain/shop.dart';
import 'package:mobile_client/features/shops/presentation/home_controller.dart';
import 'package:mobile_client/features/shops/presentation/home_screen.dart';
import 'package:mobile_client/features/shops/presentation/widgets/shop_card.dart';

Shop _shop(String name, {double distance = 500, bool open = true}) => Shop(
      id: name,
      name: name,
      logoUrl: null,
      phone: '+998900000000',
      addressText: 'Test address',
      lat: 41.3,
      lng: 69.24,
      openTime: '08:00',
      closeTime: '22:00',
      isOpen: open,
      isCurrentlyOpen: open,
      distanceMeters: distance,
      productCount: 5,
    );

void main() {
  late I18nService i18n;

  setUp(() async {
    i18n = I18nService();
    await i18n.load();
  });

  Future<void> pump(WidgetTester tester, List<Shop> shops) async {
    // Phone width, tall enough that the lazy list builds every shop card.
    tester.view.physicalSize = const Size(390, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          i18nServiceProvider.overrideWithValue(i18n),
          nearbyShopsProvider.overrideWith((ref) async => shops),
          homeCategoriesProvider.overrideWith((ref) async => const []),
          locationPromptEnabledProvider.overrideWithValue(false),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('renders nearby shop names and distances', (tester) async {
    await pump(tester, [_shop('Chilonzor Market', distance: 450), _shop('Yunusobod Bazaar', distance: 1800)]);

    expect(find.text('Chilonzor Market'), findsOneWidget);
    expect(find.text('Yunusobod Bazaar'), findsOneWidget);
    expect(find.text('450 m'), findsOneWidget);
    expect(find.text('1.8 km'), findsOneWidget);
    expect(find.byType(ShopCard), findsNWidgets(2));
  });

  testWidgets('shows the delivery address, section header and open/closed badges', (tester) async {
    await pump(tester, [_shop('Open Shop'), _shop('Closed Shop', open: false)]);

    expect(find.text('Toshkent shahri'), findsOneWidget);
    expect(find.text('Yaqin do\'konlar'), findsOneWidget);
    expect(find.text('Ochiq'), findsOneWidget);
    expect(find.text('Yopiq'), findsOneWidget);
    expect(find.text('08:00–22:00'), findsNWidgets(2));
  });

  testWidgets('shows the empty state when there are no nearby shops', (tester) async {
    await pump(tester, []);
    expect(find.text('3 km radiusda do\'konlar topilmadi'), findsOneWidget);
    expect(find.byType(ShopCard), findsNothing);
  });

  testWidgets('search field filters the shop list client-side', (tester) async {
    await pump(tester, [_shop('Chilonzor Market'), _shop('Yunusobod Bazaar')]);

    await tester.enterText(find.byType(TextField), 'Chilonzor');
    await tester.pumpAndSettle();

    expect(find.text('Chilonzor Market'), findsOneWidget);
    expect(find.text('Yunusobod Bazaar'), findsNothing);
  });

  testWidgets('the map is not built in list mode', (tester) async {
    await pump(tester, [_shop('Chilonzor Market')]);
    expect(find.byType(FlutterMap), findsNothing);
  });
}
