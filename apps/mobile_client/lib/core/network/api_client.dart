import 'package:dio/dio.dart';
import '../config/env.dart';
import '../errors/app_exception.dart';
import '../storage/token_storage.dart';
import 'auth_interceptor.dart';

/// Thin wrapper around Dio: callers get plain JSON-ish data back and a
/// uniform [AppException] on failure, never a raw [DioException].
class ApiClient {
  ApiClient({
    required TokenStorage tokenStorage,
    required void Function() onSessionExpired,
    void Function()? onTokenRefreshed,
  }) : _dio = Dio(BaseOptions(
          baseUrl: Env.apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
        )) {
    _dio.interceptors.add(AuthInterceptor(
      dio: _dio,
      tokenStorage: tokenStorage,
      baseUrl: Env.apiBaseUrl,
      onSessionExpired: onSessionExpired,
      onTokenRefreshed: onTokenRefreshed,
    ));
  }

  final Dio _dio;

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _run(() => _dio.get(path, queryParameters: query));

  Future<dynamic> post(String path, {Object? data, Map<String, String>? headers}) =>
      _run(() => _dio.post(path, data: data, options: headers != null ? Options(headers: headers) : null));

  Future<dynamic> put(String path, {Object? data}) => _run(() => _dio.put(path, data: data));

  Future<dynamic> patch(String path, {Object? data}) => _run(() => _dio.patch(path, data: data));

  Future<dynamic> delete(String path) => _run(() => _dio.delete(path));

  /// Uploads an image file to POST /uploads/image and returns the response's
  /// server-relative url (e.g. "/uploads/abc.webp") — the caller resolves it
  /// to an absolute url (see Env for the media root, same host as the API
  /// minus the /api/v1 suffix).
  Future<String> uploadImage(String filePath) async {
    final fileName = filePath.split(RegExp(r'[\\/]')).last;
    final form = FormData.fromMap({'file': await MultipartFile.fromFile(filePath, filename: fileName)});
    final data = await _run(() => _dio.post('/uploads/image', data: form)) as Map<String, dynamic>;
    return data['url'] as String;
  }

  Future<dynamic> _run(Future<Response> Function() request) async {
    try {
      final response = await request();
      return response.data;
    } on DioException catch (e) {
      throw AppException.fromDioException(e);
    }
  }
}
