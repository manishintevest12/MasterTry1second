import 'package:url_launcher/url_launcher.dart';

import 'app_state.dart';

/// CLICK-BASED APP AD (owner 3 Nov, his words: "App ke andar kabhi bhi direct auto-popup ya
/// background JavaScript inject mat karna, nahi toh Google Play Store kuch hi dino mein app ban kar
/// dega... ads ya smartlinks ko tabhi trigger karein jab user khud kisi button par click kare...
/// External Redirection (url_launcher) ... default browser").
///
/// Rules this file enforces, so a future change cannot quietly break Play policy:
///  1. NOTHING here is called on app start, on a screen open, or on a timer. Every entry point
///     takes a user tap with it (the caller only calls from onTap).
///  2. The hop always leaves for the OS DEFAULT BROWSER (`LaunchMode.externalApplication`). No
///     in-app overlay, no injected JS, no popunder inside the app.
///  3. The URL comes from the server (/api/app-ads) so the operator can rotate or disable the
///     smartlink without shipping a new APK.
///  4. Merchant exits are NOT touched: those keep their own in-app browser path (owner rule that
///     every seller exit stays inside the app), because an ad must never replace a real deal.
class AdSmartlink {
  AdSmartlink._();

  static String? _cached;

  /// Smartlink from the server, cached for the session. Null when the operator disabled it.
  static Future<String?> url() async {
    if (_cached != null) return _cached!.isEmpty ? null : _cached;
    try {
      final res = await AppState.instance.api.getJsonPublic('/api/app-ads');
      final link = (res['smartlink'] as String?)?.trim();
      _cached = link ?? '';
      return (link == null || link.isEmpty) ? null : link;
    } catch (_) {
      _cached = '';
      return null;
    }
  }

  /// Must be called ONLY from a user tap handler. Returns true when the browser took the hop.
  static Future<bool> openFromUserTap() async {
    final link = await url();
    if (link == null) return false;
    final uri = Uri.tryParse(link);
    if (uri == null || !(uri.isScheme('https') || uri.isScheme('http'))) return false;
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  /// Test seam: forget the cached link.
  static void resetCacheForTest() => _cached = null;
}
