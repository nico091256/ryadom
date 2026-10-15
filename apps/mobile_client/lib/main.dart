import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/app.dart';
import 'core/i18n/i18n_service.dart';
import 'core/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final i18n = I18nService();
  await i18n.load();
  final persistedLocale = await LocaleController.loadPersisted();

  runApp(
    ProviderScope(
      overrides: [
        i18nServiceProvider.overrideWithValue(i18n),
        localeProvider.overrideWith(() => LocaleController(persistedLocale)),
      ],
      child: const RyadomApp(),
    ),
  );
}
