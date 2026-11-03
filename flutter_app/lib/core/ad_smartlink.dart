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

  /// Ad-network domains the server is allowed to publish (kept as a client-side second check).
  /// Mirrors server/marketing/adSafety.ts; anything else is refused instead of launched.
  static const _allowedHosts = <String>['araplhn.org', 'bauval.org', 'abscloud.org'];

  /// At most one ad hop per app session (owner: "flow disturb tho ni kr raha"). A second tap in the
  /// same session does nothing, so a stray double-tap can never fire two browser hops.
  static bool _openedThisSession = false;

  static bool _hostAllowed(String host) {
    final h = host.toLowerCase();
    return _allowedHosts.any((a) => h == a || h.endsWith('.$a'));
  }

  /// Must be called ONLY from a user tap handler. Returns true when the browser took the hop.
  /// Play-safe by construction: https only, known ad-network host only, external browser only,
  /// once per session, and no launch at all when the operator disabled the link.
  static Future<bool> openFromUserTap() async {
    if (_openedThisSession) return false;
    final link = await url();
    if (link == null) return false;
    final uri = Uri.tryParse(link);
    if (uri == null || !uri.isScheme('https')) return false;
    if (!_hostAllowed(uri.host)) return false;
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (opened) _openedThisSession = true;
      return opened;
    } catch (_) {
      return false;
    }
  }

  /// Test seam: forget the cached link.
  static void resetCacheForTest() {
    _cached = null;
    _openedThisSession = false;
  }
}
