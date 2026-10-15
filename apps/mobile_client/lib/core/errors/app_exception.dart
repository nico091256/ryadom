import 'package:dio/dio.dart';

/// Normalized error surfaced to the UI, carrying the backend's
/// `{ code, message }` envelope when available (see HttpExceptionFilter on
/// the API side) instead of a raw DioException.
class AppException implements Exception {
  AppException(this.message, {this.code});

  final String message;
  final String? code;

  factory AppException.fromDioException(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final error = data['error'];
      if (error is Map<String, dynamic>) {
        return AppException(error['message']?.toString() ?? 'Xatolik yuz berdi', code: error['code']?.toString());
      }
      final message = data['message'];
      if (message is String) return AppException(message);
      if (message is List && message.isNotEmpty) return AppException(message.join(', '));
    }

    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
      return AppException("Server bilan aloqa yo'q. Internetni tekshiring.", code: 'NETWORK_ERROR');
    }

    return AppException(e.message ?? 'Kutilmagan xatolik yuz berdi');
  }

  @override
  String toString() => message;
}
