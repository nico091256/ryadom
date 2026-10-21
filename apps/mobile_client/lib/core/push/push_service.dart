import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../network/api_client.dart';

/// FCM device registration for order push notifications.
///
/// The backend already sends FCM pushes to every token registered through
/// `POST /devices`; this is the client half. It is deliberately defensive:
/// without a Firebase project configured for the app (`google-services.json` /
/// `GoogleService-Info.plist`) `Firebase.initializeApp()` throws, and the
/// service simply stays disabled — the app keeps working on polling + Socket.IO.
/// Web is skipped: web push needs a service worker + VAPID key that are not set up.
class PushService {
  PushService({required ApiClient client}) : _client = client; // ignore: prefer_initializing_formals

  final ApiClient _client;

  bool _initialised = false;
  bool _available = false;
  String? _registeredToken;
  StreamSubscription<String>? _refreshSub;

  /// True once Firebase initialised successfully on this device.
  bool get isAvailable => _available;

  /// Initialises Firebase (once), asks for notification permission and
  /// registers the current FCM token for the signed-in user. Safe to call
  /// repeatedly (after login, on every cold start) and never throws.
  Future<void> register() async {
    if (kIsWeb) return;
    try {
      if (!await _ensureFirebase()) return;
      final messaging = FirebaseMessaging.instance;

      final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        if (kDebugMode) debugPrint('[push] notification permission denied');
        return;
      }

      final token = await messaging.getToken();
      if (token != null) await _upload(token);

      _refreshSub ??= messaging.onTokenRefresh.listen((t) => _upload(t));
    } catch (e) {
      if (kDebugMode) debugPrint('[push] register failed: $e');
    }
  }

  /// Removes this device's token server-side (on logout) so the next user of
  /// the phone does not receive the previous user's order updates.
  Future<void> unregister() async {
    final token = _registeredToken;
    _registeredToken = null;
    await _refreshSub?.cancel();
    _refreshSub = null;
    if (token == null) return;
    try {
      await _client.delete('/devices/${Uri.encodeComponent(token)}');
    } catch (e) {
      if (kDebugMode) debugPrint('[push] unregister failed: $e');
    }
  }

  Future<bool> _ensureFirebase() async {
    if (_initialised) return _available;
    _initialised = true;
    try {
      // Platform config files (google-services.json / GoogleService-Info.plist)
      // provide the options; without them this throws and push stays off.
      await Firebase.initializeApp();
      _available = true;
    } catch (e) {
      _available = false;
      if (kDebugMode) debugPrint('[push] Firebase not configured, push notifications disabled ($e)');
    }
    return _available;
  }

  Future<void> _upload(String token) async {
    if (token == _registeredToken) return;
    try {
      await _client.post('/devices', data: {'token': token, 'platform': _platform});
      _registeredToken = token;
    } catch (e) {
      if (kDebugMode) debugPrint('[push] token upload failed: $e');
    }
  }

  static String get _platform {
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return 'web';
  }
}
