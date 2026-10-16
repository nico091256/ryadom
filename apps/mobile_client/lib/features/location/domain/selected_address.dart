class SelectedAddress {
  const SelectedAddress({
    required this.lat,
    required this.lng,
    required this.addressText,
    this.entrance,
    this.floor,
    this.apartment,
    this.doorCode,
  });

  final double lat;
  final double lng;
  final String addressText;
  final String? entrance;
  final String? floor;
  final String? apartment;
  final String? doorCode;

  /// Tashkent city center — same default the RN app used before a real
  /// location is detected or chosen.
  static const tashkentDefault = SelectedAddress(lat: 41.2995, lng: 69.2401, addressText: 'Toshkent shahri');

  SelectedAddress copyWith({
    double? lat,
    double? lng,
    String? addressText,
    String? entrance,
    String? floor,
    String? apartment,
    String? doorCode,
  }) {
    return SelectedAddress(
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      addressText: addressText ?? this.addressText,
      entrance: entrance ?? this.entrance,
      floor: floor ?? this.floor,
      apartment: apartment ?? this.apartment,
      doorCode: doorCode ?? this.doorCode,
    );
  }
}
