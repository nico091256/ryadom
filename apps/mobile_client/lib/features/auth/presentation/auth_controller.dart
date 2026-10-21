import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../data/auth_api.dart';
import '../domain/app_user.dart';

final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.read(apiClientProvider)));

final authControllerProvider = AsyncNotifierProvider<AuthController, AppUser?>(AuthController.new);

class AuthController extends AsyncNotifier<AppUser?> {
  @override
  Future<AppUser?> build() async {
    ref.listen<int>(sessionExpiredNotifierProvider, (previous, next) {
      if (previous != null && next != previous) {
        state = const AsyncData(null);
      }
    });

    final token = await ref.read(tokenStorageProvider).getAccessToken();
    if (token == null) return null;

    try {
      final user = await ref.read(authApiProvider).fetchMe();
      _registerPush();
      return user;
    } catch (_) {
      await ref.read(tokenStorageProvider).clear();
      return null;
    }
  }

  /// Fire-and-forget: push registration must never delay or fail sign-in.
  void _registerPush() {
    unawaited(ref.read(pushServiceProvider).register());
  }

  Future<void> sendCode(String phone) => ref.read(authApiProvider).sendCode(phone);

  /// Returns true if this created a brand-new account (caller should then
  /// prompt for a name).
  Future<bool> verifyCode(String phone, String code) async {
    final result = await ref.read(authApiProvider).verify(phone, code);
    await ref.read(tokenStorageProvider).saveTokens(accessToken: result.accessToken, refreshToken: result.refreshToken);
    state = AsyncData(result.user);
    _registerPush();
    return result.isNewUser;
  }

  Future<void> saveName(String name) async {
    final updated = await ref.read(authApiProvider).updateProfile(name: name);
    state = AsyncData(updated);
  }

  Future<void> changeLanguage(String languageCode) async {
    final current = state.value;
    if (current == null) return; // guest — language is stored locally only until login
    final updated = await ref.read(authApiProvider).updateProfile(language: languageCode);
    state = AsyncData(updated);
  }

  Future<void> logout() async {
    final tokenStorage = ref.read(tokenStorageProvider);
    // While the access token is still valid: stop this phone receiving the
    // account's order pushes.
    await ref.read(pushServiceProvider).unregister();
    final refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken != null) {
      try {
        await ref.read(authApiProvider).logout(refreshToken);
      } catch (_) {
        // best-effort server-side revoke; local logout proceeds regardless
      }
    }
    await tokenStorage.clear();
    state = const AsyncData(null);
  }
}
