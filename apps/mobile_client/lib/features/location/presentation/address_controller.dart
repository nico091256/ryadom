import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/providers.dart';
import '../data/geocoding_api.dart';
import '../domain/selected_address.dart';

enum LocationFailureReason { permissionDenied, permissionDeniedForever, serviceDisabled, unknown }

class LocationException implements Exception {
  LocationException(this.reason);
  final LocationFailureReason reason;
}

final geocodingApiProvider = Provider<GeocodingApi>((ref) => GeocodingApi(ref.read(apiClientProvider)));

final addressControllerProvider = NotifierProvider<AddressController, SelectedAddress>(AddressController.new);

class AddressController extends Notifier<SelectedAddress> {
  static const _prefsKey = 'ryadom_delivery_address';

  /// Completes once the last saved address has been read back from storage,
  /// so callers that decide on a fresh GPS lookup do not race the restore.
  Future<void> restored = Future.value();

  @override
  SelectedAddress build() {
    restored = _restore();
    return SelectedAddress.tashkentDefault;
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsKey);
      if (raw == null || !state.isPlaceholder) return;
      state = SelectedAddress.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      // No persistent storage (tests, private mode) or a corrupt entry: keep the default.
    }
  }

  Future<void> _save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, jsonEncode(state.toJson()));
    } catch (_) {}
  }

  void setManual(SelectedAddress address) {
    state = address;
    _save();
  }

  /// Reverse-geocodes a point picked on a map and makes it the delivery
  /// address. Entrance/floor details belong to the old place, so they reset.
  Future<SelectedAddress> pickPoint(double lat, double lng, {String lang = 'uz'}) async {
    final addressText = await ref.read(geocodingApiProvider).reverseGeocode(lat, lng, lang: lang);
    setManual(SelectedAddress(lat: lat, lng: lng, addressText: addressText));
    return state;
  }

  /// Detects the device's current position and reverse-geocodes it. Throws
  /// [LocationException] with a specific reason the UI can message clearly,
  /// mirroring the RN app's permission-state handling. With
  /// [requestPermission] false it never shows the OS dialog (silent refresh).
  Future<void> detectCurrentLocation({String lang = 'uz', bool requestPermission = true}) async {
    final position = await currentPosition(requestPermission: requestPermission);
    try {
      await pickPoint(position.latitude, position.longitude, lang: lang);
    } catch (_) {
      throw LocationException(LocationFailureReason.unknown);
    }
  }

  /// The device's GPS position, without touching the selected address.
  Future<Position> currentPosition({bool requestPermission = true}) async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw LocationException(LocationFailureReason.serviceDisabled);
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied && requestPermission) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw LocationException(LocationFailureReason.permissionDenied);
    }
    if (permission == LocationPermission.deniedForever) {
      throw LocationException(LocationFailureReason.permissionDeniedForever);
    }

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
    } catch (_) {
      throw LocationException(LocationFailureReason.unknown);
    }
  }
}
