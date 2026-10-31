class Shop {
  const Shop({
    required this.id,
    required this.name,
    this.logoUrl,
    this.bannerUrl,
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
  /// Round brand mark (avatar in lists / the header card).
  final String? logoUrl;
  /// Wide 16:9 cover photo; see [coverUrl] for the display fallback.
  final String? bannerUrl;
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

  /// What the cover surfaces (Home card, shop page app bar) show: the banner
  /// when the shop uploaded one, else the logo, else the brand gradient.
  String? get coverUrl {
    final b = bannerUrl?.trim();
    if (b != null && b.isNotEmpty) return b;
    return logoUrl;
  }

  factory Shop.fromJson(Map<String, dynamic> json) => Shop(
        id: json['id'] as String,
        name: json['name'] as String,
        logoUrl: json['logo_url'] as String?,
        bannerUrl: json['banner_url'] as String?,
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
