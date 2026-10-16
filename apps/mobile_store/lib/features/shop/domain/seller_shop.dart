class SellerShop {
  const SellerShop({
    required this.id,
    required this.name,
    required this.phone,
    this.logoUrl,
    required this.addressText,
    required this.lat,
    required this.lng,
    required this.openTime,
    required this.closeTime,
    required this.isOpen,
  });

  final String id;
  final String name;
  final String phone;
  final String? logoUrl;
  final String addressText;
  final double lat;
  final double lng;
  final String openTime;
  final String closeTime;
  final bool isOpen;

  factory SellerShop.fromJson(Map<String, dynamic> json) => SellerShop(
        id: json['id'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String? ?? '',
        logoUrl: json['logo_url'] as String?,
        addressText: json['address_text'] as String? ?? '',
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        openTime: json['open_time'] as String? ?? '08:00',
        closeTime: json['close_time'] as String? ?? '22:00',
        isOpen: json['is_open'] as bool? ?? false,
      );
}
