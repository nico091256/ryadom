import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb, kReleaseMode, visibleForTesting;

/// Per-environment configuration, set via --dart-define at build/run time:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:4000/api/v1
///
/// Falls back to sensible dev defaults (Android emulator's host alias,
/// localhost for web/iOS simulator) in debug/profile builds, and to the
/// production API (`https://api.ryadom.uz/api/v1`) in release builds when
/// `API_BASE_URL` is not explicitly provided.
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
  static const productionApiBaseUrl = 'https://api.ryadom.uz/api/v1';

  static String get apiBaseUrl {
    if (_apiOverride.isNotEmpty) return _apiOverride;
    if (kIsWeb) return inferWebApiBase(Uri.base);
    if (kReleaseMode) return productionApiBaseUrl;
    if (Platform.isAndroid) return 'http://10.0.2.2:4000/api/v1';
    return 'http://localhost:4000/api/v1';
  }

  /// Web fallback when no API_BASE_URL was defined at build time. Local hosts
  /// (localhost, LAN IPs) keep the dev API on :4000; a deployed domain maps to
  /// its `api.` sibling over https (client.ryadom.uz → https://api.ryadom.uz),
  /// so a release build never points at a dead `<page-host>:4000`.
  @visibleForTesting
  static String inferWebApiBase(Uri pageUri) {
    final host = pageUri.host;
    if (host.isEmpty || _isLocalHost(host)) {
      return 'http://${host.isEmpty ? 'localhost' : host}:4000/api/v1';
    }
    final labels = host.split('.');
    // client.ryadom.uz → ryadom.uz; ryadom.uz stays as is.
    final apex = labels.length >= 3 ? labels.sublist(1).join('.') : host;
    return 'https://api.$apex/api/v1';
  }

  static bool _isLocalHost(String host) {
    if (host == 'localhost' || host.endsWith('.localhost') || host == '0.0.0.0' || host == '::1' || host == '[::1]') {
      return true;
    }
    // Bare IPv4 (phone on the LAN) or a single-label host: never a public deployment.
    return RegExp(r'^\d{1,3}(\.\d{1,3}){3}$').hasMatch(host) || !host.contains('.');
  }

  /// Socket.IO server root (no /api/v1 suffix — the gateway is mounted at /).
  static String get socketUrl {
    if (_socketOverride.isNotEmpty) return _stripTrailingSlash(_socketOverride);
    return apiOrigin;
  }

  /// The API host without the `/api/v1` prefix — where static `/uploads/*` and
  /// the socket live. Always consistent with [apiBaseUrl].
  static String get apiOrigin => extractOrigin(apiBaseUrl);

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

  /// Extracts `scheme://host[:port]` from an API base URL (including hosts whose
  /// subdomain starts with `api.`, such as `https://api.ryadom.uz/api/v1`).
  @visibleForTesting
  static String extractOrigin(String api) {
    final trimmed = _stripTrailingSlash(api.trim());
    final uri = Uri.tryParse(trimmed);
    if (uri != null && uri.hasScheme && uri.host.isNotEmpty) {
      return uri.origin;
    }
    final cleaned = trimmed.replaceFirst(RegExp(r'/api(?:/v\d+)?/?$'), '');
    return _stripTrailingSlash(cleaned);
  }

  static String _stripTrailingSlash(String s) => s.endsWith('/') ? s.substring(0, s.length - 1) : s;
}
