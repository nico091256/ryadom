import '../../../core/network/api_client.dart';
import '../domain/app_user.dart';

class LoginResult {
  const LoginResult({required this.accessToken, required this.refreshToken, required this.user});

  final String accessToken;
  final String refreshToken;
  final AppUser user;
}

class AuthApi {
  AuthApi(this._client);
  final ApiClient _client;

  Future<LoginResult> login(String login, String password) async {
    final data = await _client.post('/auth/login', data: {'login': login, 'password': password}) as Map<String, dynamic>;
    return LoginResult(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      user: AppUser.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<AppUser> fetchMe() async {
    final data = await _client.get('/me') as Map<String, dynamic>;
    return AppUser.fromJson(data);
  }

  Future<void> changePassword(String currentPassword, String newPassword) => _client.post('/auth/change-password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  Future<void> logout(String refreshToken) => _client.post('/auth/logout', data: {'refreshToken': refreshToken});
}
