import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';

/// Reverse geocoding ikki bosqichli:
///   1. Backend proxy `GET /geocode/reverse` → Yandex Geocoder (server tomonda;
///      web'da CORS bo'lmaydi, API kalit brauzerda ochilmaydi, natija keshlanadi).
///   2. Kalit sozlanmagan yoki Yandex javob bermasa — Nominatim/OSM fallback,
///      u ham bo'lmasa koordinata matni.
class GeocodingApi {
  GeocodingApi(this._client) : _dio = Dio();

  final ApiClient _client;
  final Dio _dio;

  Future<String> reverseGeocode(double lat, double lng, {String lang = 'uz'}) async {
    final viaBackend = await _viaBackend(lat, lng, lang);
    if (viaBackend != null && viaBackend.isNotEmpty) return viaBackend;
    return _viaNominatim(lat, lng, lang);
  }

  /// Yandex Geocoder (backend proxy). Manzil topilmasa/xato bo'lsa — null.
  Future<String?> _viaBackend(double lat, double lng, String lang) async {
    try {
      final data = await _client.get('/geocode/reverse', query: {
        'lat': lat,
        'lng': lng,
        'lang': lang,
      }) as Map<String, dynamic>;
      final address = data['address'] as String?;
      return (address != null && address.trim().isNotEmpty) ? address.trim() : null;
    } catch (_) {
      return null;
    }
  }

  /// Nominatim/OpenStreetMap fallback — barcha platformalarda CORS'siz ishlaydi,
  /// API kalit talab qilmaydi.
  Future<String> _viaNominatim(double lat, double lng, String lang) async {
    try {
      final response = await _dio.get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {'format': 'jsonv2', 'lat': lat, 'lon': lng, 'accept-language': lang, 'zoom': 18},
        options: Options(headers: {'User-Agent': 'RyadomApp/1.0'}),
      );
      final data = response.data as Map<String, dynamic>;
      final address = (data['address'] as Map<String, dynamic>?) ?? {};
      final street = address['road'] != null
          ? _join([address['road'] as String?, address['house_number'] as String?])
          : address['neighbourhood'] as String?;
      final text = _join([
        (address['city'] ?? address['town'] ?? address['state']) as String?,
        (address['suburb'] ?? address['city_district'] ?? address['county']) as String?,
        street,
      ]);
      return text.isNotEmpty ? text : (data['display_name'] as String? ?? _fallback(lat, lng));
    } catch (_) {
      return _fallback(lat, lng);
    }
  }

  String _join(List<String?> parts) => parts.where((p) => p != null && p.isNotEmpty).toSet().join(', ');

  String _fallback(double lat, double lng) => '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
}
