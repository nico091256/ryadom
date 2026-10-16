import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

/// Per-environment configuration, set via --dart-define at build/run time:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:4000/api/v1
///
/// Falls back to sensible dev defaults (Android emulator's host alias,
/// localhost for web/iOS simulator) when not provided — mirrors the RN app's
/// dev convenience, but as an explicit, overridable default instead of a
/// hardcoded LAN IP.
class Env {
  Env._();

  static String get apiBaseUrl {
    const override = String.fromEnvironment('API_BASE_URL');
    if (override.isNotEmpty) return override;

    if (kIsWeb) return 'http://localhost:4000/api/v1';
    if (Platform.isAndroid) return 'http://10.0.2.2:4000/api/v1';
    return 'http://localhost:4000/api/v1';
  }

  /// Socket.IO server root (no /api/v1 suffix — the gateway is mounted at /).
  static String get socketUrl {
    const override = String.fromEnvironment('SOCKET_URL');
    if (override.isNotEmpty) return override;

    final api = apiBaseUrl;
    final idx = api.indexOf('/api');
    return idx == -1 ? api : api.substring(0, idx);
  }

  /// Root for server-relative media paths like "/uploads/abc.webp" — static
  /// files are served from the API host without the /api/v1 prefix.
  static String get mediaBaseUrl => socketUrl;

  /// Resolves a server-relative path (or passes through an already-absolute
  /// url) to something an Image widget can load directly.
  static String resolveMediaUrl(String pathOrUrl) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
    return '$mediaBaseUrl$pathOrUrl';
  }
}
