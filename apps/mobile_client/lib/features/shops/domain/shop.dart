class Shop {
  const Shop({
    required this.id,
    required this.name,
    this.logoUrl,
    required this.phone,
    required this.addressText,
    required this.lat,
    required this.lng,
    required this.openTime,
    required this.closeTime,
    required this.isOpen,
    required this.isCurrentlyOpen,
    required this.distanceMeters,
    required this.productCount,
  });

  final String id;
  final String name;
  final String? logoUrl;
  final String phone;
  final String addressText;
  final double lat;
  final double lng;
  final String openTime;
  final String closeTime;
  final bool isOpen;
  final bool isCurrentlyOpen;
  final double distanceMeters;
  final int productCount;

  factory Shop.fromJson(Map<String, dynamic> json) => Shop(
        id: json['id'] as String,
        name: json['name'] as String,
        logoUrl: json['logo_url'] as String?,
        phone: json['phone'] as String? ?? '',
        addressText: json['address_text'] as String? ?? '',
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        openTime: json['open_time'] as String? ?? '08:00',
        closeTime: json['close_time'] as String? ?? '22:00',
        isOpen: json['is_open'] as bool? ?? false,
        isCurrentlyOpen: json['isCurrentlyOpen'] as bool? ?? false,
        distanceMeters: (json['distanceMeters'] as num?)?.toDouble() ?? 0,
        productCount: (json['productCount'] as num?)?.toInt() ?? 0,
      );
}
