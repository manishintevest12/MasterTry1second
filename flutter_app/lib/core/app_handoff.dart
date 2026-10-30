import 'dart:io' show Platform;

import 'package:android_intent_plus/android_intent.dart';
import 'package:url_launcher/url_launcher.dart';

/// APP-TO-APP HANDOFF (owner 30 Oct)
///
/// The engine builds exits that can carry an Android
/// `intent://host/path#Intent;scheme=https;package=<pkg>;S.browser_fallback_url=<paid url>;end`.
/// A webview cannot resolve such a URL itself, so it is parsed here and handed to the OS:
/// the partner's own installed app opens when it exists, and the tracked/affiliate URL in
/// `browser_fallback_url` is what loads when it does not. Nothing here changes the money
/// path — the fallback is always the paid link the engine already minted.
class AppHandoff {
  /// True when this URL must leave the webview (Android intent or a custom scheme).
  static bool isExternalHandoff(String url) {
    final u = url.trim().toLowerCase();
    if (u.startsWith('intent://') || u.startsWith('market://')) return true;
    // http(s) stays inside the browser; anything scheme-like is an app hop
    // (uber://, olacabs://, blinkit://, swiggy://, ...).
    final scheme = Uri.tryParse(url)?.scheme.toLowerCase() ?? '';
    return scheme.isNotEmpty && scheme != 'http' && scheme != 'https';
  }

  /// Launch the app behind [url]. Returns the fallback URL to load in the webview when the
  /// app could not be opened (or null when the handoff succeeded / has no fallback).
  static Future<String?> open(String url, {bool tryOnlyIfInstalled = true}) async {
    try {
      if (url.toLowerCase().startsWith('intent://')) {
        return await _openIntent(url, tryOnlyIfInstalled: tryOnlyIfInstalled);
      }
      final uri = Uri.parse(url);
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      return ok ? null : null; // no fallback info for a bare scheme; caller keeps the page
    } catch (_) {
      return null;
    }
  }

  static Future<String?> _openIntent(String url, {required bool tryOnlyIfInstalled}) async {
    final parsed = _parseIntent(url);
    if (parsed == null) return null;
    final fallback = parsed['fallback'];
    if (!Platform.isAndroid) return fallback;

    if (tryOnlyIfInstalled && parsed['package'] != null) {
      final installed = await _isInstalled(parsed['package']!);
      if (!installed) return fallback;
    }
    try {
      final intent = AndroidIntent(
        action: 'action_view',
        data: parsed['data'],
        package: parsed['package'],
      );
      await intent.launch();
      return null;
    } catch (_) {
      return fallback;
    }
  }

  static Future<bool> _isInstalled(String package) async {
    // android_intent_plus has no query API, so attempt resolution by launching only after
    // the caller decided; treat an exception at launch time as "not installed" (handled by
    // _openIntent). Returning true here keeps the fast path: one launch attempt, and the
    // engine's browser_fallback_url covers the miss.
    return package.isNotEmpty;
  }

  /// Minimal parser for `intent://<data>#Intent;<k=v>;...;end`.
  static Map<String, String?>? _parseIntent(String url) {
    final hash = url.indexOf('#Intent;');
    if (hash <= 0) return null;
    final data = url.substring('intent://'.length, hash);
    final tail = url.substring(hash + '#Intent;'.length);
    String? package;
    String? fallback;
    for (final part in tail.split(';')) {
      final eq = part.indexOf('=');
      if (eq <= 0) continue;
      final k = part.substring(0, eq).trim();
      final v = Uri.decodeComponent(part.substring(eq + 1).trim());
      if (k == 'package') package = v;
      if (k == 'S.browser_fallback_url') fallback = v;
    }
    final scheme = tail.contains('scheme=https') ? 'https' : null;
    final openUrl = scheme == null ? null : 'https://$data';
    return {'data': openUrl, 'package': package, 'fallback': fallback};
  }
}
