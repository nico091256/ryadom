import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_client/core/i18n/i18n_service.dart';
import 'package:mobile_client/core/providers.dart';
import 'package:mobile_client/features/shops/domain/shop.dart';
import 'package:mobile_client/features/shops/presentation/home_controller.dart';
import 'package:mobile_client/features/shops/presentation/home_screen.dart';

Shop _shop(String name, {double distance = 500}) => Shop(
      id: name,
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
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          i18nServiceProvider.overrideWithValue(i18n),
          nearbyShopsProvider.overrideWith((ref) async => shops),
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
  });

  testWidgets('shows the empty state when there are no nearby shops', (tester) async {
    await pump(tester, []);
    expect(find.text('3 km radiusda do\'konlar topilmadi'), findsOneWidget);
  });

  testWidgets('search field filters the shop list client-side', (tester) async {
    await pump(tester, [_shop('Chilonzor Market'), _shop('Yunusobod Bazaar')]);

    await tester.enterText(find.byType(TextField), 'Chilonzor');
    await tester.pumpAndSettle();

    expect(find.text('Chilonzor Market'), findsOneWidget);
    expect(find.text('Yunusobod Bazaar'), findsNothing);
  });
}
