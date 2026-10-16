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
      return await ref.read(authApiProvider).fetchMe();
    } catch (_) {
      await ref.read(tokenStorageProvider).clear();
      return null;
    }
  }

  Future<void> login(String login, String password) async {
    final result = await ref.read(authApiProvider).login(login, password);
    await ref.read(tokenStorageProvider).saveTokens(accessToken: result.accessToken, refreshToken: result.refreshToken);
    state = AsyncData(result.user);
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await ref.read(authApiProvider).changePassword(currentPassword, newPassword);
    final current = state.value;
    if (current != null) {
      state = AsyncData(AppUser(
        id: current.id,
        login: current.login,
        phone: current.phone,
        name: current.name,
        role: current.role,
        language: current.language,
        mustChangePassword: false,
        shopId: current.shopId,
      ));
    }
  }

  Future<void> logout() async {
    final tokenStorage = ref.read(tokenStorageProvider);
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
