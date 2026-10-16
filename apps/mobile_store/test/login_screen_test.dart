import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_store/core/i18n/i18n_service.dart';
import 'package:mobile_store/core/providers.dart';
import 'package:mobile_store/features/auth/presentation/login_screen.dart';

void main() {
  late I18nService i18n;

  setUp(() async {
    i18n = I18nService();
    await i18n.load();
  });

  testWidgets('shows a validation error when submitting without credentials', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [i18nServiceProvider.overrideWithValue(i18n)],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Kirish'));
    await tester.pump();

    expect(find.text('Login va parolni to\'ldiring'), findsOneWidget);
  });
}
