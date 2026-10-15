import '../../../core/network/api_client.dart';
import '../domain/app_user.dart';

class VerifyResult {
  const VerifyResult({required this.accessToken, required this.refreshToken, required this.isNewUser, required this.user});

  final String accessToken;
  final String refreshToken;
  final bool isNewUser;
  final AppUser user;
}

class AuthApi {
  AuthApi(this._client);
  final ApiClient _client;

  Future<void> sendCode(String phone) => _client.post('/auth/send-code', data: {'phone': phone});

  Future<VerifyResult> verify(String phone, String code) async {
    final data = await _client.post('/auth/verify', data: {'phone': phone, 'code': code}) as Map<String, dynamic>;
    return VerifyResult(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      isNewUser: data['isNewUser'] as bool? ?? false,
      user: AppUser.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<AppUser> fetchMe() async {
    final data = await _client.get('/me') as Map<String, dynamic>;
    return AppUser.fromJson(data);
  }

  Future<AppUser> updateProfile({String? name, String? language}) async {
    final data = await _client.patch('/me', data: {
      'name': ?name,
      'language': ?language,
    }) as Map<String, dynamic>;
    return AppUser.fromJson(data);
  }

  Future<void> logout(String refreshToken) => _client.post('/auth/logout', data: {'refreshToken': refreshToken});
}
