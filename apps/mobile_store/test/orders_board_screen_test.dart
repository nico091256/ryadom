import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:localshop_shared/localshop_shared.dart';
import 'package:mobile_store/core/i18n/i18n_service.dart';
import 'package:mobile_store/core/providers.dart';
import 'package:mobile_store/features/orders/domain/store_order.dart';
import 'package:mobile_store/features/orders/presentation/orders_board_screen.dart';
import 'package:mobile_store/features/orders/presentation/orders_providers.dart';

StoreOrder _order(String id, OrderStatus status, {DateTime? createdAt}) => StoreOrder(
      id: id,
      status: status,
      paymentMethod: PaymentMethod.cash,
      totalAmount: 50000,
      addressText: 'Test address',
      addressLat: 41.3,
      addressLng: 69.24,
      customerName: 'Test Customer',
      customerPhone: '+998900000000',
      createdAt: createdAt ?? DateTime.now(),
      items: const [StoreOrderItem(productName: 'Non', unitPrice: 5000, quantity: 2)],
    );

void main() {
  late I18nService i18n;

  setUp(() async {
    i18n = I18nService();
    await i18n.load();
  });

  // OrdersBoardScreen runs periodic Timers (polling + countdown ticks), so
  // pumpAndSettle would wait indefinitely for them to stop. Pump bounded
  // frames instead.
  Future<void> pump(WidgetTester tester, List<StoreOrder> orders) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          i18nServiceProvider.overrideWithValue(i18n),
          ordersListProvider.overrideWith((ref) async => orders),
        ],
        child: const MaterialApp(home: OrdersBoardScreen()),
      ),
    );
    await tester.pump(Duration.zero); // flush the async provider override
    await tester.pump();
  }

  // Unmounts OrdersBoardScreen so its periodic Timers get cancelled in
  // dispose() before flutter_test's end-of-test pending-timer check runs.
  Future<void> unmount(WidgetTester tester) => tester.pumpWidget(const SizedBox());

  testWidgets('shows Accept/Reject for a new order on the New tab', (tester) async {
    await pump(tester, [_order('11111111-1111-1111-1111-111111111111', OrderStatus.newOrder)]);

    expect(find.text('Qabul qilish'), findsOneWidget);
    expect(find.text('Rad etish'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('shows "mark on the way" for an accepted order on the In Progress tab', (tester) async {
    await pump(tester, [_order('22222222-2222-2222-2222-222222222222', OrderStatus.accepted)]);

    await tester.tap(find.text('Jarayonda'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Yetkazishga chiqdim'), findsOneWidget);
    expect(find.text('Qabul qilish'), findsNothing);

    await unmount(tester);
  });

  testWidgets('a delivered order on the Completed tab has no action buttons', (tester) async {
    await pump(tester, [_order('33333333-3333-3333-3333-333333333333', OrderStatus.delivered)]);

    await tester.tap(find.text('Tugallangan'));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Yetkazib berildi'), findsNothing);
    expect(find.text('Qabul qilish'), findsNothing);

    await unmount(tester);
  });
}
