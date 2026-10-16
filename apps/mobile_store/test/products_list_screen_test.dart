import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_store/core/i18n/i18n_service.dart';
import 'package:mobile_store/core/providers.dart';
import 'package:mobile_store/features/shop/domain/seller_product.dart';
import 'package:mobile_store/features/shop/presentation/products_list_screen.dart';
import 'package:mobile_store/features/shop/presentation/shop_providers.dart';

void main() {
  late I18nService i18n;

  setUp(() async {
    i18n = I18nService();
    await i18n.load();
  });

  testWidgets('renders products and filters them by the search field', (tester) async {
    const products = [
      SellerProduct(id: 'p1', categoryId: 'c1', nameUz: 'Non', price: 500000, stock: 10, isAvailable: true),
      SellerProduct(id: 'p2', categoryId: 'c1', nameUz: 'Sut', price: 1300000, stock: 5, isAvailable: true),
    ];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          i18nServiceProvider.overrideWithValue(i18n),
          sellerProductsProvider.overrideWith((ref) async => products),
        ],
        child: const MaterialApp(home: ProductsListScreen()),
      ),
    );
    await tester.pump(Duration.zero);
    await tester.pump();

    expect(find.text('Non'), findsOneWidget);
    expect(find.text('Sut'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Non');
    await tester.pump();

    // "Non" now also appears as the search field's own text, alongside the
    // matching product card — just confirm "Sut" was filtered out.
    expect(find.text('Sut'), findsNothing);
  });
}
