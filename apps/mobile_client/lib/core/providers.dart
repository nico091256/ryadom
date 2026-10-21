import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:localshop_shared/localshop_shared.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'i18n/i18n_service.dart';
import 'network/api_client.dart';
import 'push/push_service.dart';
import 'realtime/order_socket.dart';
import 'storage/token_storage.dart';

/// Overridden in main.dart once the asset bundle has loaded — see bootstrap().
final i18nServiceProvider = Provider<I18nService>((ref) => throw UnimplementedError('I18nService not loaded yet'));

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

/// Lazily resolved so the auth controller can already exist by the time a
/// 401 actually triggers this (there is no construction-order issue).
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    tokenStorage: ref.read(tokenStorageProvider),
    onSessionExpired: () => ref.read(sessionExpiredNotifierProvider.notifier).state++,
    // A refreshed access token must also reach the socket handshake.
    onTokenRefreshed: () => ref.read(orderSocketProvider).reconnect(),
  );
});

/// FCM token registration; a no-op until a Firebase project is configured.
final pushServiceProvider = Provider<PushService>((ref) => PushService(client: ref.read(apiClientProvider)));

/// Realtime order status pushes (Socket.IO). Connects lazily on first
/// [OrderSocket.watchOrder] and disconnects when nobody is watching.
final orderSocketProvider = Provider<OrderSocket>((ref) {
  final socket = OrderSocket(tokenStorage: ref.read(tokenStorageProvider));
  ref.onDispose(socket.dispose);
  return socket;
});

/// Bumped every time the session expires (refresh failed); auth_controller
/// listens to this to force a logout without a circular provider reference.
final sessionExpiredNotifierProvider = StateProvider<int>((ref) => 0);

const _localePrefsKey = 'ryadom_locale';

class LocaleController extends Notifier<SupportedLanguage> {
  LocaleController([this._initial = SupportedLanguage.uz]);
  final SupportedLanguage _initial;

  @override
  SupportedLanguage build() => _initial;

  Future<void> change(SupportedLanguage lang) async {
    state = lang;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localePrefsKey, lang.value);
  }

  static Future<SupportedLanguage> loadPersisted() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_localePrefsKey);
    if (saved == null) return SupportedLanguage.uz;
    try {
      return SupportedLanguage.fromValue(saved);
    } catch (_) {
      return SupportedLanguage.uz;
    }
  }
}

final localeProvider = NotifierProvider<LocaleController, SupportedLanguage>(LocaleController.new);

/// `ref.t('auth.phoneTitle')` — translates in the current locale.
extension TranslateRef on Ref {
  String t(String key, [Map<String, String>? params]) {
    final lang = read(localeProvider);
    return read(i18nServiceProvider).t(lang, key, params);
  }
}

extension TranslateWidgetRef on WidgetRef {
  String t(String key, [Map<String, String>? params]) {
    final lang = watch(localeProvider);
    return watch(i18nServiceProvider).t(lang, key, params);
  }
}
