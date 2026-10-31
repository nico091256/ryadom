import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

/// Per-environment configuration, set via --dart-define at build/run time:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:4000/api/v1
///
/// Falls back to sensible dev defaults (Android emulator's host alias,
/// localhost for web/iOS simulator) when not provided.
///
/// The socket/media root is DERIVED from API_BASE_URL unless SOCKET_URL is set
/// explicitly: a production web build served from client.ryadom.uz with
/// API_BASE_URL=https://api.ryadom.uz/api/v1 must load images and the
/// realtime socket from api.ryadom.uz — not from "client.ryadom.uz:4000",
/// which is what the old page-host fallback produced.
class Env {
  Env._();

  static const _apiOverride = String.fromEnvironment('API_BASE_URL');
  static const _socketOverride = String.fromEnvironment('SOCKET_URL');

  static String get apiBaseUrl {
    if (_apiOverride.isNotEmpty) return _apiOverride;

    if (kIsWeb) {
      final host = Uri.base.host;
      if (host.isNotEmpty) return 'http://$host:4000/api/v1';
      return 'http://localhost:4000/api/v1';
    }

    if (Platform.isAndroid) return 'http://10.0.2.2:4000/api/v1';
    return 'http://localhost:4000/api/v1';
  }

  /// Socket.IO server root (no /api/v1 suffix — the gateway is mounted at /).
  static String get socketUrl {
    if (_socketOverride.isNotEmpty) return _stripTrailingSlash(_socketOverride);
    return apiOrigin;
  }

  /// The API host without the `/api/v1` prefix — where static `/uploads/*` and
  /// the socket live. Always consistent with [apiBaseUrl].
  static String get apiOrigin => _stripApiPrefix(apiBaseUrl);

  /// Root for server-relative media paths like "/uploads/abc.webp" — static
  /// files are served from the API host without the /api/v1 prefix.
  static String get mediaBaseUrl => apiOrigin;

  /// Resolves a server-relative path (or passes through an already-absolute
  /// url) to something an Image widget can load directly.
  static String resolveMediaUrl(String pathOrUrl) {
    final v = pathOrUrl.trim();
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:') || v.startsWith('blob:')) return v;
    if (v.startsWith('//')) return '${Uri.parse(apiBaseUrl).scheme}:$v';
    return v.startsWith('/') ? '$mediaBaseUrl$v' : '$mediaBaseUrl/$v';
  }

  static String _stripApiPrefix(String api) {
    final idx = api.indexOf('/api');
    return _stripTrailingSlash(idx == -1 ? api : api.substring(0, idx));
  }

  static String _stripTrailingSlash(String s) => s.endsWith('/') ? s.substring(0, s.length - 1) : s;
}
