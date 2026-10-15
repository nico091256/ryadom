import 'package:localshop_shared/localshop_shared.dart';

class AppUser {
  const AppUser({required this.id, this.phone, this.name, required this.role, required this.language});

  final String id;
  final String? phone;
  final String? name;
  final UserRole role;
  final SupportedLanguage language;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        phone: json['phone'] as String?,
        name: json['name'] as String?,
        role: UserRole.fromValue(json['role'] as String? ?? 'customer'),
        language: SupportedLanguage.fromValue(json['language'] as String? ?? 'uz'),
      );
}
