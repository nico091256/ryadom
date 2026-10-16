import 'package:dio/dio.dart';

/// Reverse geocoding via the public Nominatim/OpenStreetMap API — the same
/// fallback the RN app used on web, used here unconditionally for all
/// platforms to avoid depending on a native geocoding plugin + API key.
class GeocodingApi {
  GeocodingApi() : _dio = Dio();

  final Dio _dio;

  Future<String> reverseGeocode(double lat, double lng, {String lang = 'uz'}) async {
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
