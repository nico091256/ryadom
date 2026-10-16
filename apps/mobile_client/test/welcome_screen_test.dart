import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_client/core/i18n/i18n_service.dart';
import 'package:mobile_client/core/providers.dart';
import 'package:mobile_client/features/auth/presentation/welcome_screen.dart';

void main() {
  late I18nService i18n;

  setUp(() async {
    i18n = I18nService();
    await i18n.load();
  });

  Future<void> pumpWelcome(WidgetTester tester) async {
    final router = GoRouter(initialLocation: '/welcome', routes: [
      GoRoute(path: '/welcome', builder: (context, state) => const WelcomeScreen()),
      GoRoute(path: '/auth/phone', builder: (context, state) => const Scaffold(body: Text('PHONE_SCREEN'))),
    ]);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [i18nServiceProvider.overrideWithValue(i18n)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('shows the Uzbek welcome copy by default', (tester) async {
    await pumpWelcome(tester);
    expect(find.text('Tilni tanlang'), findsOneWidget);
    expect(find.text('Davom etish'), findsOneWidget);
  });

  testWidgets('switching the language control updates the displayed copy', (tester) async {
    await pumpWelcome(tester);
    await tester.tap(find.text('Русский'));
    await tester.pump();
    expect(find.text('Выберите язык'), findsOneWidget);
    expect(find.text('Продолжить'), findsOneWidget);
  });

  testWidgets('tapping continue navigates to the phone screen', (tester) async {
    await pumpWelcome(tester);
    await tester.tap(find.text('Davom etish'));
    await tester.pumpAndSettle();
    expect(find.text('PHONE_SCREEN'), findsOneWidget);
  });
}
