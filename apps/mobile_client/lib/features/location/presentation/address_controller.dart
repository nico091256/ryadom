import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../data/geocoding_api.dart';
import '../domain/selected_address.dart';

enum LocationFailureReason { permissionDenied, permissionDeniedForever, serviceDisabled, unknown }

class LocationException implements Exception {
  LocationException(this.reason);
  final LocationFailureReason reason;
}

final geocodingApiProvider = Provider<GeocodingApi>((ref) => GeocodingApi());

final addressControllerProvider = NotifierProvider<AddressController, SelectedAddress>(AddressController.new);

class AddressController extends Notifier<SelectedAddress> {
  @override
  SelectedAddress build() => SelectedAddress.tashkentDefault;

  void setManual(SelectedAddress address) => state = address;

  /// Detects the device's current position and reverse-geocodes it. Throws
  /// [LocationException] with a specific reason the UI can message clearly,
  /// mirroring the RN app's permission-state handling.
  Future<void> detectCurrentLocation({String lang = 'uz'}) async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw LocationException(LocationFailureReason.serviceDisabled);
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw LocationException(LocationFailureReason.permissionDenied);
    }
    if (permission == LocationPermission.deniedForever) {
      throw LocationException(LocationFailureReason.permissionDeniedForever);
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final addressText = await ref.read(geocodingApiProvider).reverseGeocode(position.latitude, position.longitude, lang: lang);
      state = SelectedAddress(lat: position.latitude, lng: position.longitude, addressText: addressText);
    } catch (_) {
      throw LocationException(LocationFailureReason.unknown);
    }
  }
}
