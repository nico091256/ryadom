import 'package:localshop_shared/localshop_shared.dart';

class AppUser {
  const AppUser({
    required this.id,
    this.login,
    this.phone,
    this.name,
    required this.role,
    required this.language,
    this.mustChangePassword = false,
    this.shopId,
  });

  final String id;
  final String? login;
  final String? phone;
  final String? name;
  final UserRole role;
  final SupportedLanguage language;
  final bool mustChangePassword;
  final String? shopId;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    // POST /auth/login returns a flat `shopId`; GET /me returns a `shops` array.
    final shops = json['shops'] as List<dynamic>?;
    final shopId = json['shopId'] as String? ?? (shops != null && shops.isNotEmpty ? shops.first['id'] as String? : null);

    return AppUser(
      id: json['id'] as String,
      login: json['login'] as String?,
      phone: json['phone'] as String?,
      name: json['name'] as String?,
      role: UserRole.fromValue(json['role'] as String? ?? 'seller'),
      language: SupportedLanguage.fromValue(json['language'] as String? ?? 'uz'),
      mustChangePassword: json['must_change_password'] as bool? ?? false,
      shopId: shopId,
    );
  }
}
