import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Play-policy guard (owner 3 Nov): the app may show an ad ONLY on a user tap, and that hop must
/// leave for the OS default browser. These are source contracts, so a future edit cannot quietly
/// turn the smartlink into an auto-popup or an in-app overlay.
void main() {
  final src = File('lib/core/ad_smartlink.dart').readAsStringSync();

  test('the ad hop always uses the external default browser', () {
    expect(src.contains('LaunchMode.externalApplication'), isTrue);
    expect(src.contains('LaunchMode.inAppBrowserView'), isFalse);
    expect(src.contains('LaunchMode.platformDefault'), isFalse);
  });

  test('nothing auto-fires: no timers, no lifecycle hooks, no route push', () {
    for (final banned in ['Timer(', 'WidgetsBinding', 'initState', 'addPostFrameCallback', 'Navigator.push']) {
      expect(src.contains(banned), isFalse, reason: 'ad smartlink must never fire itself ($banned)');
    }
  });

  // OWNER 7 Nov: the guard's intent is "only a plain web scheme may leave the app". The launcher
  // rejects anything that is not https and never allows http, so the contract is asserted on the
  // https check plus the absence of any other scheme, instead of demanding an http allowance the
  // code (correctly) never had.
  test('only https links may leave the app', () {
    expect(src.contains("uri.isScheme('https')"), isTrue);
    expect(src.contains("uri.isScheme('http')"), isFalse);
    expect(src.contains('javascript:'), isFalse);
    expect(src.contains('intent://'), isFalse);
  });
}
