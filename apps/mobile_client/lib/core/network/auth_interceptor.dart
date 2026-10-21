import 'package:dio/dio.dart';
import '../storage/token_storage.dart';

/// Attaches the access token to every request and, on a 401, transparently
/// refreshes it (via POST /auth/refresh) and retries the original request
/// exactly once. Concurrent 401s share a single in-flight refresh instead of
/// each firing their own.
///
/// This fixes a real gap found in the RN app and the admin panel: neither
/// ever called the refresh endpoint — a 401 just logged the user out.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this.dio,
    required this.tokenStorage,
    required this.baseUrl,
    required this.onSessionExpired,
    this.onTokenRefreshed,
  });

  final Dio dio;
  final TokenStorage tokenStorage;
  final String baseUrl;
  final void Function() onSessionExpired;

  /// Called after a successful refresh (new tokens already persisted) so other
  /// token consumers — the realtime socket — can re-authenticate.
  final void Function()? onTokenRefreshed;

  Future<String?>? _refreshing;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await tokenStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final response = err.response;
    final request = err.requestOptions;
    final isAuthEndpoint = request.path.contains('/auth/');

    if (response?.statusCode != 401 || isAuthEndpoint || request.extra['retried'] == true) {
      handler.next(err);
      return;
    }

    final newAccessToken = await _refreshAccessToken();
    if (newAccessToken == null) {
      await tokenStorage.clear();
      onSessionExpired();
      handler.next(err);
      return;
    }

    try {
      request.extra['retried'] = true;
      request.headers['Authorization'] = 'Bearer $newAccessToken';
      final retried = await dio.fetch(request);
      handler.resolve(retried);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  /// Coalesces concurrent refresh attempts into one network call.
  Future<String?> _refreshAccessToken() {
    return _refreshing ??= _performRefresh().whenComplete(() => _refreshing = null);
  }

  Future<String?> _performRefresh() async {
    final refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken == null) return null;

    try {
      final response = await Dio().post(
        '$baseUrl/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data as Map<String, dynamic>;
      final accessToken = data['accessToken'] as String;
      final newRefreshToken = data['refreshToken'] as String;
      await tokenStorage.saveTokens(accessToken: accessToken, refreshToken: newRefreshToken);
      onTokenRefreshed?.call();
      return accessToken;
    } catch (_) {
      return null;
    }
  }
}
