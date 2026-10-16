import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_client/core/i18n/i18n_service.dart';
import 'package:mobile_client/core/providers.dart';
import 'package:mobile_client/features/cart/presentation/cart_controller.dart';
import 'package:mobile_client/features/orders/presentation/checkout_screen.dart';
import 'package:mobile_client/features/shops/domain/product.dart';

void main() {
  late I18nService i18n;

  setUp(() async {
    i18n = I18nService();
    await i18n.load();
  });

  testWidgets('renders the checkout form with the current address and live cart total', (tester) async {
    final container = ProviderContainer(overrides: [i18nServiceProvider.overrideWithValue(i18n)]);
    addTearDown(container.dispose);

    container.read(cartControllerProvider.notifier).addOrIncrement(
          const Product(id: 'p1', shopId: 's1', categoryId: 'c1', nameUz: 'Non', price: 500000, stock: 10, isAvailable: true),
          'Test Shop',
        );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: CheckoutScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Buyurtmani rasmiylashtirish'), findsOneWidget);
    // The bottom action bar always shows the live cart total next to the
    // place-order button, regardless of how much of the form scrolls off-screen.
    // The summary section repeats the same amount when it is within the viewport.
    expect(find.text("5 000 so'm"), findsAtLeastNWidgets(1));
    expect(find.text('Toshkent shahri'), findsOneWidget);
  });
}
