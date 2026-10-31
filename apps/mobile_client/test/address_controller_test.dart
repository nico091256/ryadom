import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_client/core/network/api_client.dart';
import 'package:mobile_client/core/storage/token_storage.dart';
import 'package:mobile_client/features/location/data/geocoding_api.dart';
import 'package:mobile_client/features/location/domain/selected_address.dart';
import 'package:mobile_client/features/location/presentation/address_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeGeocoding extends GeocodingApi {
  // The client is never used: reverseGeocode is overridden, so no request leaves the test.
  _FakeGeocoding() : super(ApiClient(tokenStorage: TokenStorage(), onSessionExpired: () {}));

  @override
  Future<String> reverseGeocode(double lat, double lng, {String lang = 'uz'}) async => 'Toshkent, Chilonzor, Bunyodkor 12';
}

void main() {
  ProviderContainer make() => ProviderContainer(overrides: [geocodingApiProvider.overrideWithValue(_FakeGeocoding())]);

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('a picked map point is resolved, saved and restored next launch', () async {
    final first = make();
    final saved = await first.read(addressControllerProvider.notifier).pickPoint(41.28, 69.2);
    expect(saved.addressText, 'Toshkent, Chilonzor, Bunyodkor 12');
    expect(first.read(addressControllerProvider).lat, 41.28);
    await Future<void>.delayed(Duration.zero);
    first.dispose();

    final next = make();
    expect(next.read(addressControllerProvider).isPlaceholder, isTrue);
    await next.read(addressControllerProvider.notifier).restored;
    final restored = next.read(addressControllerProvider);
    expect(restored.addressText, 'Toshkent, Chilonzor, Bunyodkor 12');
    expect(restored.lng, 69.2);
    expect(restored.isPlaceholder, isFalse);
    next.dispose();
  });

  test('without a saved address the city-centre default stays', () async {
    final c = make();
    await c.read(addressControllerProvider.notifier).restored;
    expect(identical(c.read(addressControllerProvider), SelectedAddress.tashkentDefault), isTrue);
    c.dispose();
  });
}
