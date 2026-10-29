import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'auth.dart';

/// Device alerts for the Android app (owner 29 Oct: "app par bhi push chahiye, image ke saath").
///
/// The server does all the composing: title, body, big-picture artwork and the tap target
/// all arrive in the FCM payload, so Android itself draws the notification (with the image)
/// while the app is backgrounded or closed. This file only does three things:
///   1. asks the user once for notification permission,
///   2. hands our server the device token so it can address this phone,
///   3. follows the tap target when the user opens a notification.
///
/// Everything is failure-tolerant on purpose: a missing Play Services, a denied permission
/// or an offline boot must never keep the app from starting.
class PushAlerts {
  PushAlerts._();

  static bool _started = false;
  static StreamSubscription<String>? _refreshSub;

  /// Called once from main(). Never throws, never blocks the first frame.
  static Future<void> init() async {
    if (_started) return;
    _started = true;
    try {
      await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;

      // Permission: on Android 13+ this is the POST_NOTIFICATIONS dialog; on older
      // versions the platform grants it silently. A refusal is respected quietly.
      final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[push] permission denied by the user — no device alerts this session');
        return;
      }

      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) await _register(token);

      // Google rotates tokens; re-register so a phone never goes silent.
      _refreshSub = messaging.onTokenRefresh.listen((t) {
        if (t.isNotEmpty) unawaited(_register(t));
      });

      // Taps: the server puts the destination in data['url'].
      FirebaseMessaging.onMessageOpenedApp.listen(_openFromMessage);
      final initial = await messaging.getInitialMessage();
      if (initial != null) _openFromMessage(initial);
    } catch (e) {
      debugPrint('[push] device alerts unavailable: $e');
    }
  }

  /// Registers the token with our own API. Signed-in users are linked to their account;
  /// a signed-out install still receives broadcast alerts.
  static Future<void> _register(String token) async {
    try {
      final auth = AuthService.instance;
      final res = await http
          .post(
            Uri.parse('$kDefaultApiBase/api/push/device'),
            headers: {
              'Content-Type': 'application/json',
              if (auth.token != null && auth.token!.isNotEmpty) 'Authorization': 'Bearer ${auth.token}',
            },
            body: jsonEncode({'token': token}),
          )
          .timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) {
        debugPrint('[push] token registration answered ${res.statusCode}');
      }
    } catch (e) {
      debugPrint('[push] token registration failed: $e');
    }
  }

  /// Opens the notification's destination through the normal exit path (affiliate-safe).
  static Future<void> _openFromMessage(RemoteMessage message) async {
    final raw = (message.data['url'] ?? '').toString().trim();
    if (raw.isEmpty) return;
    final uri = Uri.tryParse(raw.startsWith('/') ? '$kDefaultApiBase$raw' : raw);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('[push] could not open $uri: $e');
    }
  }

  /// Lets a sign-in (or sign-out) re-link this device to the current account.
  static Future<void> refresh() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) await _register(token);
    } catch (e) {
      debugPrint('[push] refresh skipped: $e');
    }
  }

  static Future<void> dispose() async {
    await _refreshSub?.cancel();
    _refreshSub = null;
  }
}
