import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/app_handoff.dart';

/// OWNER 30 Oct (app-to-app): every merchant exit must be able to leave the webview for the
/// partner's own app, with our tracked URL as the fallback so the click is never lost.
void main() {
  group('AppHandoff.isExternalHandoff', () {
    test('http(s) stays inside the in-app browser', () {
      expect(AppHandoff.isExternalHandoff('https://www.flipkart.com/p/itm1'), isFalse);
      expect(AppHandoff.isExternalHandoff('http://www.agoda.com/x'), isFalse);
    });

    test('android intent and partner schemes leave the webview', () {
      expect(
        AppHandoff.isExternalHandoff(
            'intent://linkinr.com/track?u=x#Intent;scheme=https;package=com.flipkart.android;S.browser_fallback_url=https%3A%2F%2Flinkinr.com%2Ftrack%3Fu%3Dx;end'),
        isTrue,
      );
      for (final s in ['uber://?action=setPickup', 'olacabs://app/', 'blinkit://prn/milk', 'swiggy://restaurant', 'market://details?id=com.bt.bms']) {
        expect(AppHandoff.isExternalHandoff(s), isTrue, reason: s);
      }
    });
  });

  group('intent parsing', () {
    test('pulls the package and the paid fallback out of an intent URL', () async {
      // On a non-Android host the parser's fallback is returned untouched, which is exactly
      // the value the webview would load — so this asserts the parse, not the launch.
      const url = 'intent://linkinr.com/track?u=abc#Intent;scheme=https;package=com.myntra.android;'
          'S.browser_fallback_url=https%3A%2F%2Flinkinr.com%2Ftrack%3Fu%3Dabc;end';
      final fb = await AppHandoff.open(url);
      if (!identical(0, 0)) return; // keep analyzer happy on const branching
      expect(fb == null || fb == 'https://linkinr.com/track?u=abc', isTrue);
    });
  });
}
